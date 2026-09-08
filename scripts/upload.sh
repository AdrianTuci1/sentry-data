#!/usr/bin/env bash
set -e

# Create Metadata
if [[ -z "${TRAVIS_TAG}" ]]; then
  export VERSION=nightly
else
  export VERSION=${TRAVIS_TAG}
fi

echo "version=${VERSION}" > metadata.txt;
echo "build_url=${TRAVIS_BUILD_WEB_URL}" >> metadata.txt
echo "sha=$(git rev-parse HEAD)" >> metadata.txt
echo "time=$(date +%FT%T)" >> metadata.txt

# Activate GCP Access
echo ${GCP_TOKEN} > gcp.json
gcloud auth activate-service-account --key-file gcp.json
gcloud config set project staticlabs

# Upload binary
upload(){
  file=$1
  path=$2

  echo "Uploading ${file} to gs://prod-cdn.statsparrot.com/statsparrot/${VERSION}/${path}"
  gsutil cp ${file} gs://prod-cdn.statsparrot.com/statsparrot/${VERSION}/${path}

  if [[ "${VERSION}" != "nightly" ]]; then
    echo "Uploading ${file} to gs://prod-cdn.statsparrot.com/statsparrot/latest/${path}"
    gsutil cp ${file} gs://prod-cdn.statsparrot.com/statsparrot/latest/${path}
  fi
}

if [[ ${TRAVIS_OS_NAME} == "osx" ]]; then
  cp staticlabs/statsparrot-macos-x64 statsparrot
  shasum -a 256 statsparrot > statsparrot.sha256
  upload statsparrot macos-x64/statsparrot
  upload statsparrot.sha256 macos-x64/statsparrot.sha256
  upload metadata.txt metadata.txt
fi

if [[ ${TRAVIS_OS_NAME} == "linux" ]]; then
  cp staticlabs/statsparrot-linux-x64 statsparrot
  shasum -a 256 statsparrot > statsparrot.sha256
  upload statsparrot linux-x64/statsparrot
  upload statsparrot.sha256 linux-x64/statsparrot.sha256
fi

if [[ ${TRAVIS_OS_NAME} == "windows" ]]; then
  cp gcp.json /c/gcp.json
  echo -e "[Credentials]\ngs_service_key_file=c:/gcp.json" > /c/.boto
  export BOTO_CONFIG="c:/.boto"

  gsutil() {
    /c/Program\ Files\ \(x86\)/Google/Cloud\ SDK/google-cloud-sdk/platform/gsutil_py2/gsutil $1 $2 $3
  }

  CertUtil -hashfile staticlabs/statsparrot-win-x64.exe SHA256 > statsparrot.sha256

  upload staticlabs/statsparrot-win-x64.exe win-x64/statsparrot.exe
  upload statsparrot.sha256 win-x64/statsparrot.sha256
fi
