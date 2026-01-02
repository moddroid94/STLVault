import requests
import time
import re
import base64



MODELQUERY = """
query ModelFiles($id: ID!) {
  model: print(id: $id) {
    id
    filesType
    gcodes {
      ...GcodeDetail
      __typename
    }
    stls {
      ...StlDetail
      __typename
    }
    slas {
      ...SlaDetail
      __typename
    }
    otherFiles {
      ...OtherFileDetail
      __typename
    }
    downloadPacks {
      id
      name
      fileSize
      fileType
      __typename
    }
    __typename
  }
}
fragment GcodeDetail on GCodeType {
  id
  created
  name
  folder
  note
  printer {
    id
    name
    __typename
  }
  excludeFromTotalSum
  printDuration
  layerHeight
  nozzleDiameter
  material {
    id
    name
    __typename
  }
  weight
  fileSize
  filePreviewPath
  rawDataPrinter
  order
  __typename
}
fragment OtherFileDetail on OtherFileType {
  id
  created
  name
  folder
  note
  fileSize
  filePreviewPath
  order
  __typename
}
fragment SlaDetail on SLAType {
  id
  created
  name
  folder
  note
  expTime
  firstExpTime
  printer {
    id
    name
    __typename
  }
  printDuration
  layerHeight
  usedMaterial
  fileSize
  filePreviewPath
  order
  __typename
}
fragment StlDetail on STLType {
  id
  created
  name
  folder
  note
  fileSize
  filePreviewPath
  order
  __typename
}
"""

FILEQUERY = """
mutation GetDownloadLink($id: ID!, $modelId: ID!, $fileType: DownloadFileTypeEnum!, $source: DownloadSourceEnum!) {
  getDownloadLink(
    id: $id
    printId: $modelId
    fileType: $fileType
    source: $source
  ) {
    ok
    errors {
      ...Error
      __typename
    }
    output {
      link
      count
      ttl
      __typename
    }
    __typename
  }
}
fragment Error on ErrorType {
  field
  messages
  __typename
}
"""

class PrintablesImporter():
    '''Handles the import from printables site
    '''
    def __init__(self):
        self.session: requests.Session
        self.graphurl = "https://api.printables.com/graphql/"
        self.clientId= ""
        self.fileResult: bool
        self.fileDownloadLink = ""

    def _set_client_data(self, url):
        header = {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9,it;q=0.8",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "priority": "u=0, i",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        }
        response = self.session.get(url, headers=header)
        if response.status_code != 200:
            return response.status_code

        self.clientId = re.search("data-client-uid=\"(([a-z0-9-])+)", response.text)[1]

        return True
    
    def _get_model_info(self, modelId):
        header = {
            "accept": "application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed",
            "accept-language": "en",
            "client-uid" : self.clientId,
            "cache-control": "no-cache",
            "content-type": "application/json",
            "graphql-client-version": "v3.0.11",
            "pragma": "no-cache",
            "priority": "u=1, i",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        }
        variables = {"id": modelId}

        response = self.session.post(self.graphurl, json={'query': MODELQUERY , 'variables': variables}, headers=header)

        if response.status_code != 200:
            return response.status_code
        
        modelData = response.json()
        modelCollection = []
        try:
            for model in modelData["data"]["model"]["stls"]:
                modelCollection.append(
                  {
                    "parentId": modelId,
                    "id": model["id"],
                    "name": model["name"],
                    "folder": model["folder"],
                    "previewPath": "https://files.printables.com/" + model["filePreviewPath"],
                    "typeName": model["name"].split(".")[-1],
                  }
                )
            return modelCollection
        except Exception as e:
            raise e
        
    def _get_file(self, modelId, parentId):
        header = {
            "accept": "application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed",
            "accept-language": "en",
            "client-uid" : self.clientId,
            "cache-control": "no-cache",
            "content-type": "application/json",
            "graphql-client-version": "v3.0.11",
            "pragma": "no-cache",
            "priority": "u=1, i",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        }
        variables = {"fileType":"stl","id":modelId,"modelId":parentId,"source":"model_detail"}

        response = self.session.post(self.graphurl, json={'query': FILEQUERY , 'variables': variables}, headers=header)
        if response.status_code != 200:
            return None
        fileData = response.json()
        try:
            self.fileResult = fileData["data"]["getDownloadLink"]["ok"]
            self.fileDownloadLink = fileData["data"]["getDownloadLink"]["output"]["link"]
        except Exception as e:
            raise e

        if self.fileResult is True:
            fileheader = {
                "accept": "application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed",
                "accept-language": "en",
                "client-uid" : self.clientId,
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "priority": "u=1, i",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
            }
            file = self.session.get(self.fileDownloadLink, allow_redirects=True, headers=fileheader)
            return file
    
    def _make_thumbnail(self, url):
        if len(url) > 5:
            fileheader = {
                  "accept": "image/*, application/json, text/event-stream, multipart/mixed",
                  "accept-language": "en",
                  "client-uid" : self.clientId,
                  "cache-control": "no-cache",
                  "pragma": "no-cache",
                  "priority": "u=1, i",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
            }
            file = self.session.get(url, allow_redirects=True, headers=fileheader)
            encoded_string = base64.b64encode(file.content)
            return "data:image/png;base64," + encoded_string.decode()
        
        return ""
    
    def importfromId(self, modelId, parentId, previewPath):
        self.session = requests.Session()
        try:
            self._set_client_data("https://www.printables.com/")
            time.sleep(0.1)
            file = self._get_file(modelId, parentId)
            time.sleep(0.1)
            thumbnail = self._make_thumbnail(previewPath)
            return file, thumbnail
        except Exception as e:
            raise e
        finally:
            self.session.close()

    def getModelOptions(self, url):
        self.session = requests.Session()
        modelId = re.search(r"model/(\d+)", url)[1]
        if modelId is None:
            return None
        try:
            self._set_client_data(url)
            time.sleep(0.2)
            modelData = self._get_model_info(modelId)
            return modelData
        except Exception as e:
            raise e
        finally:
            self.session.close()