import requests
import time
import re


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
    The site returns a list of models for a given url, right now we only download the first.
    we should show a modal containing the options and a tickbox to allow importing multiple files
    and handle the response accordingly
    '''
    def __init__(self):
        self.session: requests.Session
        self.graphurl = "https://api.printables.com/graphql/"
        self.modelId= ""
        self.clientId= ""
        self.fileId = ""
        self.fileName = ""
        self.fileType = ""
        self.filePreviewPath = ""
        self.fileData: None
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
    
    def _set_model_info(self, modelId, modelNr: int):
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
        try:
            self.fileId = modelData["data"]["model"]["stls"][modelNr]["id"]
            self.fileName = modelData["data"]["model"]["stls"][modelNr]["name"]
            self.fileType = self.fileName.split(".")[-1]
            self.filePreviewPath = modelData["data"]["model"]["stls"][modelNr]["filePreviewPath"]
        except Exception as e:
            raise e
        return True
    
    def _get_file(self):
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
        variables = {"fileType":self.fileType,"id":self.fileId,"modelId":self.modelId,"source":"model_detail"}

        response = self.session.post("https://api.printables.com/graphql/", json={'query': FILEQUERY , 'variables': variables}, headers=header)
        if response.status_code != 200:
            raise Exception
        
        try:
            self.fileData = response.json()
            self.fileResult = self.fileData["data"]["getDownloadLink"]["ok"]
            self.fileDownloadLink = self.fileData["data"]["getDownloadLink"]["output"]["link"]
        except Exception as e:
            raise e

        if self.fileResult:
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
            if file.status_code != 200:
                raise Exception
            return file
    
    def importfromURL(self, url):
        self.session = requests.Session()

        if self._set_client_data(url) is not True:
            return None
        
        modelId = re.search(r"model/(\d+)", url)[1]

        if self._set_model_info(modelId, 0) is not True:
            return None
        
        try:
            file = self._get_file()
            return file
        except Exception as e:
            return e
        finally:
            self.session.close()
