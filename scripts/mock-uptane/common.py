import os
import json
from datetime import datetime, timedelta
from securesystemslib.keys import generate_rsa_key
from securesystemslib.formats import encode_canonical
import hashlib

'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
CONSTANTS
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''

NAMESPACE = 'seed'
ROBOT_ID = 'seed-robot'
PRIMARY_ECU_SERIAL = 'seed-primary-ecu'
SECONDARY_ECU_SERIAL = 'seed-secondary-ecu'

KEYS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.keys')
PRIMARY_FS_ROOT_PATH = os.path.join(os.path.dirname(__file__), 'primary-fs')

IMAGE_REPO_PORT = 8001
DIRECTOR_REPO_PORT = 8001
IMAGE_REPO_HOST = f'http://localhost:{IMAGE_REPO_PORT}/api/v0/image/{NAMESPACE}'
DIRECTOR_REPO_HOST = f'http://localhost:{DIRECTOR_REPO_PORT}/api/v0/director/{NAMESPACE}'

IMAGE_REPO_NAME = 'image-repo'
IMAGE_REPO_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'primary-fs', IMAGE_REPO_NAME)
IMAGE_REPO_META_DIR = os.path.join(IMAGE_REPO_DIR, 'metadata')
IMAGE_REPO_TARGETS_DIR = os.path.join(IMAGE_REPO_DIR, 'targets')

DIRECTOR_REPO_NAME = 'director-repo'
DIRECTOR_REPO_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'primary-fs', DIRECTOR_REPO_NAME)
DIRECTOR_REPO_META_DIR = os.path.join(DIRECTOR_REPO_DIR, 'metadata')
DIRECTOR_REPO_TARGETS_DIR = os.path.join(DIRECTOR_REPO_DIR, 'targets')



'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
HELPERS
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''

def _get_time():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")


def _in(days):
    return datetime.utcnow().replace(microsecond=0) + timedelta(days=days)


def pretty_dict(d, indent=0):
   for key, value in d.items():
      print('\t' * indent + str(key))
      if isinstance(value, dict):
         pretty_dict(value, indent+1)
      else:
         print('\t' * (indent+1) + str(value) + '\n')



'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
KEYS
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
# Generate an rsa keypair and write the two keys to local key storage for testing
def create_and_write_key_pair(key_name):
    key = generate_rsa_key(bits=2048, scheme='rsassa-pss-sha256')
    pub_key_path = os.path.join(KEYS_PATH, f"{key_name}-public.pem")
    priv_key_path = os.path.join(KEYS_PATH, f"{key_name}-private.pem")
    
    with open(pub_key_path, 'w') as pub, open(priv_key_path, 'w') as priv:
        pub.write(key['keyval']['public'])
        pub.write(key['keyval']['private'])


#Read a pem key from local key storage
def load_pem_key(key_name):
    with open(os.path.join(KEYS_PATH, f'{key_name}.pem'), 'r') as f:
        return f.read()


#Convert a private pem key to a TUFKey format
def generate_priv_tuf_key(priv_key):
    
    tuf_key = {
        'keytype': 'rsa',
        'scheme': 'rsassa-pss-sha256',
        'keyval': {
            'private': priv_key,
            'public': ''
        }
    }

    key_id = hashlib.sha512(encode_canonical(tuf_key).encode('utf-8')).hexdigest()

    tuf_key['keyid'] = key_id
    return tuf_key