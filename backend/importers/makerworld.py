import base64
import re
from urllib.parse import urlparse

import requests


class MakerWorldImporter:
    """Handles imports from MakerWorld."""

    def __init__(self, token=None):
        self.session: requests.Session
        self.api_base = "https://api.bambulab.com/v1"
        self.token = token

    def _headers(self, token=None):
        headers = {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
            "Referer": "https://makerworld.com/",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _extract_model_id(self, url):
        match = re.search(r"/models/(\d+)", url)
        if match:
            return match.group(1)

        parsed = urlparse(url)
        match = re.search(r"/models/(\d+)", parsed.path)
        if match:
            return match.group(1)

        raise ValueError("Could not find a MakerWorld model ID in the URL")

    def _extract_profile_id(self, url, design):
        match = re.search(r"profileId[-=](\d+)", url)
        if not match:
            return None

        requested_id = match.group(1)
        for instance in design.get("instances", []) or []:
            if str(instance.get("id")) == requested_id:
                return str(instance.get("profileId") or requested_id)
            if str(instance.get("profileId")) == requested_id:
                return requested_id
        return requested_id

    def _get_design(self, model_id):
        response = self.session.get(
            f"{self.api_base}/design-service/design/{model_id}",
            headers=self._headers(),
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("data") or data

    def _thumbnail_url(self, design, instance=None):
        for candidate in (
            (instance or {}).get("cover") if instance else None,
            (instance or {}).get("coverUrl") if instance else None,
            design.get("cover"),
            design.get("coverUrl"),
            design.get("thumbnail"),
        ):
            if isinstance(candidate, str) and candidate:
                return candidate
        return ""

    def _make_thumbnail(self, url):
        if not url:
            return ""
        response = self.session.get(url, allow_redirects=True, timeout=30)
        response.raise_for_status()
        encoded = base64.b64encode(response.content).decode()
        content_type = response.headers.get("content-type", "image/png").split(";")[0]
        return f"data:{content_type};base64,{encoded}"

    def getModelOptions(self, url):
        self.session = requests.Session()
        try:
            model_id = self._extract_model_id(url)
            design = self._get_design(model_id)
            download_model_id = design.get("modelId") or model_id
            title = design.get("title") or design.get("name") or f"MakerWorld {model_id}"
            requested_profile_id = self._extract_profile_id(url, design)
            instances = design.get("instances", []) or []

            if requested_profile_id:
                instances = [
                    instance
                    for instance in instances
                    if str(instance.get("profileId")) == requested_profile_id
                    or str(instance.get("id")) == requested_profile_id
                ] or [{"profileId": requested_profile_id, "name": title}]

            if not instances:
                instances = [{"profileId": model_id, "name": title}]

            options = []
            for instance in instances:
                profile_id = str(instance.get("profileId") or instance.get("id"))
                name = instance.get("name") or title
                if not name.lower().endswith(".3mf"):
                    name = f"{name}.3mf"
                options.append(
                    {
                        "source": "makerworld",
                        "parentId": download_model_id,
                        "id": profile_id,
                        "name": name,
                        "folder": "MakerWorld",
                        "previewPath": self._thumbnail_url(design, instance),
                        "typeName": "3mf",
                    }
                )
            return options
        finally:
            self.session.close()

    def _download_link(self, model_id, profile_id):
        if not self.token:
            raise ValueError(
                "MakerWorld downloads require a Bambu Cloud token in Settings"
            )

        response = self.session.get(
            f"{self.api_base}/iot-service/api/user/profile/{profile_id}",
            params={"model_id": model_id},
            headers=self._headers(self.token),
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        payload = data.get("data") or data

        for key in ("url", "downloadUrl", "download_url"):
            if payload.get(key):
                return payload[key]

        for item in payload.get("files", []) or []:
            for key in ("url", "downloadUrl", "download_url"):
                if item.get(key):
                    return item[key]

        raise ValueError("MakerWorld did not return a downloadable file URL")

    def importfromId(self, profile_id, model_id, preview_path):
        self.session = requests.Session()
        try:
            download_url = self._download_link(model_id, profile_id)
            file = self.session.get(download_url, allow_redirects=True, timeout=120)
            file.raise_for_status()
            thumbnail = self._make_thumbnail(preview_path)
            return file, thumbnail
        finally:
            self.session.close()
