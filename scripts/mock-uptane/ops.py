import sys
import shutil
import os
import requests
import json

from common import (create_and_write_key_pair,
    PRIMARY_ECU_SERIAL, SECONDARY_ECU_SERIAL, PRIMARY_FS_ROOT_PATH,
    IMAGE_REPO_HOST, DIRECTOR_REPO_HOST, IMAGE_REPO_META_DIR, DIRECTOR_REPO_META_DIR)


def generate_ecu_keys():
    print('generating keys for ecus')
    create_and_write_key_pair(PRIMARY_ECU_SERIAL)
    create_and_write_key_pair(SECONDARY_ECU_SERIAL)



def init_primary_fs(): 
    print('initing primary filesystem')
    try:
        shutil.rmtree(PRIMARY_FS_ROOT_PATH)
    except: 
        pass
    
    os.mkdir(PRIMARY_FS_ROOT_PATH)
    
    os.mkdir(os.path.join(PRIMARY_FS_ROOT_PATH, 'image-repo'))
    os.mkdir(os.path.join(PRIMARY_FS_ROOT_PATH, 'image-repo', 'metadata'))
    os.mkdir(os.path.join(PRIMARY_FS_ROOT_PATH, 'image-repo', 'targets'))

    os.mkdir(os.path.join(PRIMARY_FS_ROOT_PATH, 'director-repo'))
    os.mkdir(os.path.join(PRIMARY_FS_ROOT_PATH, 'director-repo', 'metadata'))
    os.mkdir(os.path.join(PRIMARY_FS_ROOT_PATH, 'director-repo', 'targets'))
    


def cp_root_metadta():
    image_root_res = requests.get(f'{IMAGE_REPO_HOST}/1.root.json')
    director_root_res = requests.get(f'{DIRECTOR_REPO_HOST}/1.root.json')

    if image_root_res.status_code != 200 or director_root_res.status_code != 200:
        print('Unable to fetch root metadata for director or image repo. dir')
     
    else: 
        image_path = os.path.join(IMAGE_REPO_META_DIR, 'root.json')
        director_path = os.path.join(DIRECTOR_REPO_META_DIR, 'root.json')

        with open(image_path, 'w') as imgFile, open(director_path, 'w') as dirFile:
            json.dump(image_root_res.json(), imgFile)
            json.dump(director_root_res.json(), dirFile)
            print(f'Image repo root metadata was written to {image_path}')
            print(f'Director repo root metadata was written to {director_path}')


def main():

    if len(sys.argv) < 1:
        print('please provide an action')
        exit(-1)

    action = sys.argv[1]

    if action == 'init-primary-fs':
        init_primary_fs()

    elif action == 'cp-root-meta':
        cp_root_metadta()
    
    elif action == 'gen-keys':
        generate_ecu_keys()
    
    else:
        print('no such command')



if __name__=='__main__':
    main()

