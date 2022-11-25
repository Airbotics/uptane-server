import os
import json
from datetime import datetime, timedelta
from securesystemslib.keys import generate_rsa_key
from securesystemslib.formats import encode_canonical
import hashlib

'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
CONSTANTS
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''

VIN = '123456'
PRIMARY_ECU_SERIAL = 'ECU1234'
DB_ROOT_PATH = 'db'
KEYS_ROOT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.keys')
API_URL = 'http://localhost:5000'
DB_ROOT_PATH = os.path.join(os.path.dirname(__file__), 'db')
PRIMARY_FS_ROOT_PATH = os.path.join(os.path.dirname(__file__), 'primary-fs')


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
#Write a key that's already in a TUFKey format
def write_tuf_key(key_name):
    key = generate_rsa_key(bits=2048, scheme='rsassa-pss-sha256')
    with open(os.path.join(KEYS_ROOT_PATH, f'{key_name}.json'), 'w') as f:
        f.write(json.dumps(key))


#Read a key that's already in a TUFKey format
def read_tuf_key(key_name):
    with open(os.path.join(KEYS_ROOT_PATH, f'{key_name}.json'), 'r') as f:
        return json.loads(f.read())


#Read a key pair in pem format
def load_pem_key(key_name):
    with open(os.path.join(KEYS_ROOT_PATH, f'{key_name}.pem'), 'r') as f:
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