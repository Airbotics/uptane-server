'''
this script pushes a local ostree repo to a remote repo (treehub) over http.
'''

import os
import requests

REPO_ROOT_DIR = 'repo'                                          # relative directory of local ostree repo
NAMESPACE = 'example-namespace'                                 # namespace to work with
BASE_URL = f'http://localhost:8001/api/v1/treehub/{NAMESPACE}'  # base url of remote repo


# helper to read a file and return its contents
def _read_file(file_path, mode):
    with open(file_path, mode=mode) as f:
        return f.read()

# helper to push an artifact to the remote repo
def _push(path, content, content_type):
    
    res = requests.put(BASE_URL + path,
        data=content, 
        headers={'content-type': content_type})

    if res.status_code != 200:
        print('problem yeeting content to remote')
        raise Exception()

# helper to check the local repo exists
def _check_repo_exists():
    if not os.path.exists(REPO_ROOT_DIR) or not os.path.isdir(REPO_ROOT_DIR):
        print('ostree repo does not exist')
        raise Exception()
    



# push the repo's summary to the remote repo
def push_summary():
    filepath = os.path.join(REPO_ROOT_DIR, 'summary')
    content = _read_file(filepath, 'rb')
    _push('/summary', content, 'application/octet-stream')
    print('yeeted summary successfully')


# pushes the repo's objects to the remote repo
# must send content-length header
def push_objects():
    for prefix in os.listdir(os.path.join(REPO_ROOT_DIR, 'objects')):
        for obj in os.listdir(os.path.join(REPO_ROOT_DIR, 'objects', prefix)):
            content = _read_file(os.path.join(REPO_ROOT_DIR, 'objects', prefix, obj), 'rb')
            _push(f'/objects/{prefix}/{obj}', content, 'application/octet-stream')
    print('yeeted objects successfully')


# pushes the repo's refs to the remote repo
# only uploads heads, not mirrors or remotes
def push_refs():
    for ref in os.listdir(os.path.join(REPO_ROOT_DIR, 'refs', 'heads')):
        content = _read_file(os.path.join(REPO_ROOT_DIR, 'refs', 'heads', ref), 'r').strip()
        _push(f'/refs/heads/{ref}', content, 'text/plain')
    print('yeeted refs successfully')



def main():

    _check_repo_exists()
    
    # check repo directory exists
    print(f'yeeting ostree repo \'{REPO_ROOT_DIR}\'')
    
    push_summary()
    push_objects()
    push_refs()

    print(f'yeeted ostree repo \'{REPO_ROOT_DIR}\' successfully')


if __name__ == '__main__':
    main()