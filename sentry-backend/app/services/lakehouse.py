import boto3
import os
from typing import List, Dict, Optional
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

class LakehouseService:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        self.bucket_name = os.getenv('S3_LAKE_BUCKET', 'sentry-lakehouse')

    def _ensure_bucket_exists(self):
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError:
            try:
                self.s3_client.create_bucket(Bucket=self.bucket_name)
            except ClientError as e:
                print(f"Error creating bucket: {e}")

    def create_project_folder(self, project_id: str) -> bool:
        """Creates a dedicated folder (prefix) for a project in the Lakehouse."""
        try:
            # S3 doesn't typically have "empty folders", so we create a placeholder
            key = f"{project_id}/.keep"
            self.s3_client.put_object(Bucket=self.bucket_name, Key=key, Body='')
            return True
        except ClientError as e:
            print(f"Error creating project folder: {e}")
            return False

    def list_projects(self) -> List[str]:
        """Lists all top-level project folders."""
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            result = paginator.paginate(Bucket=self.bucket_name, Delimiter='/')
            
            projects = []
            for page in result:
                if 'CommonPrefixes' in page:
                    for prefix in page['CommonPrefixes']:
                        # Remove trailing slash
                        projects.append(prefix['Prefix'].rstrip('/'))
            return projects
        except ClientError as e:
            print(f"Error listing projects: {e}")
            return []

    def list_files(self, project_id: str, path: str = "") -> List[Dict]:
        """Lists files within a project's folder."""
        prefix = f"{project_id}/{path}"
        if path and not path.endswith('/'):
            prefix += '/'
            
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Skip the folder placeholder itself
                    if obj['Key'].endswith('/'): 
                        continue
                    if obj['Key'].endswith('.keep'):
                        continue
                        
                    rel_path = obj['Key'].replace(f"{project_id}/", "", 1)
                    files.append({
                        "name": rel_path.split('/')[-1],
                        "path": rel_path,
                        "size": obj['Size'],
                        "last_modified": obj['LastModified'].isoformat(),
                        "type": "file"
                    })
            return files
        except ClientError as e:
            print(f"Error listing files: {e}")
            return []

    def upload_file(self, project_id: str, file_content: bytes, file_name: str) -> Optional[str]:
        """Uploads a file to the project folder."""
        key = f"{project_id}/{file_name}"
        try:
            self.s3_client.put_object(Bucket=self.bucket_name, Key=key, Body=file_content)
            return key
        except ClientError as e:
            print(f"Error uploading file: {e}")
            return None
