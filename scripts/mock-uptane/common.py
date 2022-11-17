import os
import json
from datetime import datetime, timedelta


'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
CONSTANTS
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''

VIN = '123456'
PRIMARY_ECU_SERIAL = 'abcdef'
DB_ROOT_PATH = 'db'
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

def _load_key(role):
    with open(os.path.join(DB_ROOT_PATH, 'keys', f'{role}.json'), 'r') as f:
        return json.loads(f.read())
