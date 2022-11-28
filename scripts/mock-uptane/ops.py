import requests
import sys
import shutil
import os


from common import (create_and_write_key_pair,
    PRIMARY_ECU_SERIAL, SECONDARY_ECU_SERIAL, PRIMARY_FS_ROOT_PATH)


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
    

def main():

    if len(sys.argv) < 1:
        print('please provide an action')
        exit(-1)

    action = sys.argv[1]

    if action == 'init-primary-fs':
        init_primary_fs()

    elif action == 'gen-keys':
        generate_ecu_keys()
    
    else:
        print('no such command')



if __name__=='__main__':
    main()

