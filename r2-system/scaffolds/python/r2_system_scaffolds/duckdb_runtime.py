import os
import time
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
from threading import RLock
from typing import Any, Dict, Iterable, List, Mapping, Optional

import duckdb


@dataclass(frozen=True)
class StorageCredentials:
    accessKeyId: str = ""
    secretAccessKey: str = ""
    sessionToken: Optional[str] = None


@dataclass(frozen=True)
class StorageConfig:
    provider: str = "r2"
    endpoint: str = ""
    bucket: str = ""
    prefix: Optional[str] = None
    region: str = "auto"
    useSsl: bool = True
    urlStyle: str = "path"
    fileFormat: str = "parquet"
    globPattern: Optional[str] = None
    credentials: Optional[StorageCredentials] = None


@dataclass(frozen=True)
class QuerySpec:
    widgetId: str
    sqlString: str


@dataclass
class DuckDBLease:
    lease_id: str
    connection: duckdb.DuckDBPyConnection
    storage_fingerprint: str
    created_at: float
    touched_at: float
    expires_at: float
    lock: RLock = field(default_factory=RLock)

    def refresh(self, ttl_seconds: int) -> None:
        now = time.time()
        self.touched_at = now
        self.expires_at = now + ttl_seconds


def storage_config_from_mapping(value: Optional[Mapping[str, Any]]) -> Optional[StorageConfig]:
    if not value:
        return None

    credentials_value = value.get("credentials") or {}
    credentials = None
    if credentials_value:
        credentials = StorageCredentials(
            accessKeyId=str(credentials_value.get("accessKeyId") or ""),
            secretAccessKey=str(credentials_value.get("secretAccessKey") or ""),
            sessionToken=credentials_value.get("sessionToken"),
        )

    return StorageConfig(
        provider=str(value.get("provider") or "r2"),
        endpoint=str(value.get("endpoint") or ""),
        bucket=str(value.get("bucket") or ""),
        prefix=value.get("prefix"),
        region=str(value.get("region") or "auto"),
        useSsl=bool(value.get("useSsl", True)),
        urlStyle=str(value.get("urlStyle") or "path"),
        fileFormat=str(value.get("fileFormat") or "parquet"),
        globPattern=value.get("globPattern"),
        credentials=credentials,
    )


def _sql_literal(value: str) -> str:
    return value.replace("'", "''")


def _clean_endpoint(value: str) -> str:
    return value.replace("https://", "").replace("http://", "").rstrip("/")


def _json_safe(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    return value


def storage_fingerprint(storage_config: Optional[StorageConfig]) -> str:
    if not storage_config:
        return "env"
    credentials = storage_config.credentials
    return "|".join([
        storage_config.provider,
        _clean_endpoint(storage_config.endpoint),
        storage_config.bucket,
        storage_config.prefix or "",
        storage_config.region,
        storage_config.urlStyle,
        credentials.accessKeyId[:8] if credentials else "",
    ])


def configure_connection(con: duckdb.DuckDBPyConnection, storage_config: Optional[StorageConfig] = None) -> None:
    endpoint = storage_config.endpoint if storage_config else os.getenv("R2_ENDPOINT", "")
    region = storage_config.region if storage_config else os.getenv("R2_REGION", "auto")
    use_ssl = storage_config.useSsl if storage_config else True
    url_style = storage_config.urlStyle if storage_config else "path"
    credentials = storage_config.credentials if storage_config else None
    access_key = credentials.accessKeyId if credentials else os.getenv("R2_ACCESS_KEY_ID", "")
    secret_key = credentials.secretAccessKey if credentials else os.getenv("R2_SECRET_ACCESS_KEY", "")
    session_token = credentials.sessionToken if credentials else os.getenv("R2_SESSION_TOKEN", "")

    try:
        con.execute("INSTALL httpfs;")
    except Exception:
        pass

    con.execute("LOAD httpfs;")
    con.execute(f"SET s3_use_ssl={'true' if use_ssl else 'false'};")
    con.execute(f"SET s3_region='{_sql_literal(region or 'auto')}';")
    if endpoint:
        con.execute(f"SET s3_endpoint='{_sql_literal(_clean_endpoint(endpoint))}';")
    if access_key:
        con.execute(f"SET s3_access_key_id='{_sql_literal(access_key)}';")
    if secret_key:
        con.execute(f"SET s3_secret_access_key='{_sql_literal(secret_key)}';")
    if session_token:
        con.execute(f"SET s3_session_token='{_sql_literal(session_token)}';")
    con.execute(f"SET s3_url_style='{_sql_literal(url_style or 'path')}';")


def create_connection(storage_config: Optional[StorageConfig] = None) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(":memory:")
    configure_connection(con, storage_config)
    return con


class DuckDBRuntimePool:
    """Warm DuckDB leases for Modal containers.

    A lease keeps a DuckDB connection alive while the backend and Modal apps are
    communicating. Modal can still scale down idle containers, so callers should
    use the keepalive endpoint while a multi-step workflow is active.
    """

    def __init__(self, default_ttl_seconds: int = 900):
        self.default_ttl_seconds = default_ttl_seconds
        self._leases: Dict[str, DuckDBLease] = {}
        self._lock = RLock()

    def ensure(
        self,
        lease_id: Optional[str] = None,
        storage_config: Optional[StorageConfig] = None,
        ttl_seconds: Optional[int] = None,
    ) -> DuckDBLease:
        ttl = max(int(ttl_seconds or self.default_ttl_seconds), 30)
        fingerprint = storage_fingerprint(storage_config)

        with self._lock:
            self.cleanup_expired()
            if lease_id and lease_id in self._leases:
                lease = self._leases[lease_id]
                if lease.storage_fingerprint == fingerprint:
                    lease.refresh(ttl)
                    return lease
                self.close(lease_id)

            new_lease_id = lease_id or f"duckdb-{uuid.uuid4().hex[:16]}"
            now = time.time()
            lease = DuckDBLease(
                lease_id=new_lease_id,
                connection=create_connection(storage_config),
                storage_fingerprint=fingerprint,
                created_at=now,
                touched_at=now,
                expires_at=now + ttl,
            )
            self._leases[new_lease_id] = lease
            return lease

    def status(self, lease_id: str) -> Dict[str, Any]:
        with self._lock:
            self.cleanup_expired()
            lease = self._leases.get(lease_id)
            if not lease:
                return {"leaseId": lease_id, "status": "missing"}
            return self.lease_payload(lease)

    def keepalive(self, lease_id: str, ttl_seconds: Optional[int] = None) -> Dict[str, Any]:
        with self._lock:
            lease = self._leases.get(lease_id)
            if not lease:
                return {"leaseId": lease_id, "status": "missing"}
            lease.refresh(max(int(ttl_seconds or self.default_ttl_seconds), 30))
            return self.lease_payload(lease)

    def close(self, lease_id: str) -> bool:
        lease = self._leases.pop(lease_id, None)
        if not lease:
            return False
        try:
            lease.connection.close()
        except Exception:
            pass
        return True

    def cleanup_expired(self) -> None:
        now = time.time()
        expired = [lease_id for lease_id, lease in self._leases.items() if lease.expires_at <= now]
        for lease_id in expired:
            self.close(lease_id)

    def lease_payload(self, lease: DuckDBLease) -> Dict[str, Any]:
        return {
            "leaseId": lease.lease_id,
            "status": "active",
            "createdAt": datetime.fromtimestamp(lease.created_at, tz=timezone.utc).isoformat(),
            "touchedAt": datetime.fromtimestamp(lease.touched_at, tz=timezone.utc).isoformat(),
            "expiresAt": datetime.fromtimestamp(lease.expires_at, tz=timezone.utc).isoformat(),
            "storageFingerprint": lease.storage_fingerprint,
        }

    def execute_queries(
        self,
        queries: Iterable[QuerySpec],
        storage_config: Optional[StorageConfig] = None,
        lease_id: Optional[str] = None,
        ttl_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        lease = self.ensure(lease_id=lease_id, storage_config=storage_config, ttl_seconds=ttl_seconds)
        results: List[Dict[str, Any]] = []

        with lease.lock:
            for query in queries:
                start = time.time()
                try:
                    cursor = lease.connection.execute(query.sqlString)
                    columns = [column[0] for column in cursor.description]
                    rows = cursor.fetchall()
                    results.append({
                        "widgetId": query.widgetId,
                        "data": [
                            {column: _json_safe(value) for column, value in zip(columns, row)}
                            for row in rows
                        ],
                        "latency_ms": (time.time() - start) * 1000,
                        "error": None,
                    })
                except Exception as error:
                    results.append({
                        "widgetId": query.widgetId,
                        "data": None,
                        "latency_ms": (time.time() - start) * 1000,
                        "error": str(error),
                    })

        lease.refresh(max(int(ttl_seconds or self.default_ttl_seconds), 30))
        return {
            "lease": self.lease_payload(lease),
            "results": results,
        }
