from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import logger


class SourceProfile(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
        protected_namespaces=(),
    )

    sourceId: str
    sourceName: str
    uri: str
    source_schema: List[Dict[str, Any]] = Field(default_factory=list, alias="schema")
    fingerprint: Optional[str] = None
    sampleRows: List[Dict[str, Any]] = Field(default_factory=list)
    entityKeyCandidates: List[str] = Field(default_factory=list)
    timestampCandidates: List[str] = Field(default_factory=list)
    metricCandidates: List[str] = Field(default_factory=list)
    goldViews: List[Dict[str, Any]] = Field(default_factory=list)

    @field_validator("source_schema", mode="before")
    @classmethod
    def normalize_schema(cls, value: Any) -> List[Dict[str, Any]]:
        if value is None:
            return []
        if not isinstance(value, list):
            logger.warning("SourceProfile received non-list schema: %s", type(value).__name__)
            return []

        normalized: List[Dict[str, Any]] = []
        for index, column in enumerate(value):
            if not isinstance(column, dict):
                logger.warning("Dropping non-dict schema column at index %s: %r", index, column)
                continue

            name = str(column.get("name", "")).strip()
            if not name:
                logger.warning("Dropping schema column without a name at index %s: %r", index, column)
                continue

            cleaned = dict(column)
            cleaned["name"] = name
            if cleaned.get("type") is not None:
                cleaned["type"] = str(cleaned["type"]).strip()
            normalized.append(cleaned)

        return normalized

    @field_validator("sampleRows", mode="before")
    @classmethod
    def normalize_sample_rows(cls, value: Any) -> List[Dict[str, Any]]:
        if value is None or not isinstance(value, list):
            return []
        return [row for row in value if isinstance(row, dict)]

    @field_validator("entityKeyCandidates", "timestampCandidates", "metricCandidates", mode="before")
    @classmethod
    def normalize_string_list(cls, value: Any) -> List[str]:
        if value is None or not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]

    @field_validator("goldViews", mode="before")
    @classmethod
    def normalize_gold_views(cls, value: Any) -> List[Dict[str, Any]]:
        if value is None or not isinstance(value, list):
            return []
        return [view for view in value if isinstance(view, dict) and view.get("id")]


class CompileProjectionPlanRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    requestId: str
    tenantId: str
    projectId: str
    sourceProfiles: List[SourceProfile]
    workerUrl: Optional[str] = None
    workerSecret: Optional[str] = None
    compiledAt: str
    context: Optional[Dict[str, Any]] = None


class CompileScoreRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    requestId: str
    context: Dict[str, Any]
    reverseEtl: Optional[Dict[str, Any]] = None
