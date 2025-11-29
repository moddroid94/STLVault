## STL VAULT

A simple 3D printing model library manager.
For now supports STL, STEP and 3MF files.

PS.: This is heavily WIP, things will probably change. but apart from the import model button everything is working as expected.
yes, the base scaffolding of the site and backend is made with AI.

This is developed to be deployed with portainer directly using the repo as a source.

## Stack:
- SQLite
- FastAPI
- React


## Features:
- Nestable Folders
- Drag n' Drop app wide (Import/Move)
- Bulk Actions (Tag/Move/Delete/Download/Upload)
- 3D preview (STL, 3MF)
- Tags, Description and Metadata Sidebar
- Search and filter library wide

## Deploy
You can deploy using the docker-compose in the root folder or using the repo as a source from Portainer or similar.

The deployment creates/uses 2 folders to store model files and database file: 
/backend/uploads
/backend/data


<img width="1876" height="958" alt="image" src="https://github.com/user-attachments/assets/68addb24-1742-44e9-8136-fbe4e4b31966" />
