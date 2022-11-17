import requests
import sys
import shutil
import os
import json
from securesystemslib.keys import generate_rsa_key
from common import VIN, PRIMARY_ECU_SERIAL, API_URL, DB_ROOT_PATH, _load_key, PRIMARY_FS_ROOT_PATH

def init_db():
    print('initing db')
    try:
        shutil.rmtree(DB_ROOT_PATH)
    except: 
        pass

    os.mkdir(DB_ROOT_PATH)
    
    #key store
    os.mkdir(os.path.join(DB_ROOT_PATH, 'keys')) 
    
    #image repo
    os.mkdir(os.path.join(DB_ROOT_PATH, 'image')) #image repo db
    os.mkdir(os.path.join(DB_ROOT_PATH, 'image', 'metadata'))
    os.mkdir(os.path.join(DB_ROOT_PATH, 'image', 'targets'))
    
    #director repo
    os.mkdir(os.path.join(DB_ROOT_PATH, 'director'))
    os.mkdir(os.path.join(DB_ROOT_PATH, 'director', 'metadata'))
    os.mkdir(os.path.join(DB_ROOT_PATH, 'director', 'targets')) #target images store
    os.mkdir(os.path.join(DB_ROOT_PATH, 'director', 'inventory'))  #inventory db


def generate_keys():

    print('generating keys')

    KEY_ROOT_PATH = os.path.join(os.path.dirname(__file__), 'db', 'keys')

    def write_key(role):

        key = generate_rsa_key(bits=2048, scheme='rsassa-pss-sha256')
        with open(os.path.join(KEY_ROOT_PATH, f'{role}.json'), 'w') as f:
            f.write(json.dumps(key))

    write_key('primary')
    write_key('timeserver')
    write_key('director-root')
    write_key('director-targets')
    write_key('director-snapshot')
    write_key('director-timestamp')
    write_key('image-root')
    write_key('image-targets')
    write_key('image-snapshot')
    write_key('image-timestamp')


def init_repos():
    print('init repos')
    try:
      res = requests.get(f'{API_URL}/init')
      print(f'init repos responded with status code: {res.status_code}')
    except:
      print('Unable to init repos')



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
    
    #Copy director and image root.json
    try: 
        
        dir_remote_root = os.path.join(DB_ROOT_PATH, 'director', 'metadata', 'root.json')
        dir_local_root = os.path.join(PRIMARY_FS_ROOT_PATH, 'director-repo', 'metadata', 'root.json')
        img_remote_root = os.path.join(DB_ROOT_PATH, 'image', 'metadata', 'root.json')
        img_local_root = os.path.join(PRIMARY_FS_ROOT_PATH, 'image-repo', 'metadata', 'root.json')

        shutil.copyfile(dir_remote_root, dir_local_root)
        shutil.copyfile(img_remote_root, img_local_root)

    except Exception as e:
        print(e) 
        print('Couldnt init primary local filesystem with root.json metadata. Have you initialised the director and image repo??')



def init_inventory():

    print('initialising inventory with test vehicle')

    primary_key = _load_key('primary')

    try:
        vehicle_body = {
            'vin': VIN
        }
        res = requests.post(f'{API_URL}/director/vehicles', json=vehicle_body)
        print(f'register vehicle responded with status code: {res.status_code}')
    except:
      print('Unable to registry vehicle')

    
    try:
        ecu_body = {
            "ecu_serial": PRIMARY_ECU_SERIAL,
            "public_key": primary_key['keyval']['public']
        }
        res = requests.post(f'{API_URL}/director/vehicles/{VIN}/ecus', json=ecu_body)
        print(f'register ecu responded with status code: {res.status_code}')

    except:
      print('Unable to assign primary ecu to vehicle')


def add_image(name, content):
    print('adding image')

    body = {
        "name": name,
        "content": content
    }
    res = requests.post(f'{API_URL}/image/targets', json=body)


def resign_timestamp():
    print('resign timestamp')
    res = requests.get(f'{API_URL}/resign-timestamp')
    print(f'resigned timestamp metadata with status code: {res.status_code}')


def main():

    if len(sys.argv) < 2:
        print('please provide an action')
        exit(-1)

    action = sys.argv[1]

    if action == 'init-db':
        init_db()

    elif action == 'gen-keys':
        generate_keys()

    elif action == 'init-repos':
        init_repos()

    elif action == 'init-inventory':
        init_inventory()
    
    elif action == 'add-image':
        
        if not len(sys.argv) == 4:
            print('The second argument should be the name of the image')
            print('The third argument should be content of the image (a string for testing)')
            exit(-1)

        name = sys.argv[2]
        content = sys.argv[3]

        add_image(name, content)
    

    elif action == 'init-primary-fs':
        init_primary_fs()

    elif action == 'resign-timestamp':
        resign_timestamp()
    
    else:
        print('no such command')



if __name__=='__main__':
    main()

