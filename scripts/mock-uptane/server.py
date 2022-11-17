import os
from flask import Flask, request, abort
from colored import stylize, fg
import json
from securesystemslib.keys import create_signature
from tuf.api.metadata import (
    Key,
    Metadata,
    MetaFile,
    Root,
    Snapshot,
    TargetFile,
    Targets,
    Timestamp,
)
from tuf.api.serialization.json import JSONSerializer
from securesystemslib.signer import SSlibSigner
from pprint import pprint
from common import DB_ROOT_PATH, _get_time, _in, _load_key


app = Flask(__name__)


'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
LOAD UP ON KEYS
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
timeserver_key = _load_key('timeserver')
image_root_key = _load_key('image-root')
image_targets_key = _load_key('image-targets')
image_snapshot_key = _load_key('image-snapshot')
image_timestamp_key = _load_key('image-timestamp')
director_root_key       = _load_key('director-root')
director_targets_key    = _load_key('director-targets')
director_snapshot_key   = _load_key('director-snapshot')
director_timestamp_key  = _load_key('director-timestamp')


TEST_ECU_SERIAL = 'ECU1234'


'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
HELPERS
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
def get_metadata_versions(repo_name):
    '''
    Assume the director and image repos are always in sync for now
    '''

    if os.path.isfile(os.path.join(DB_ROOT_PATH, repo_name, 'metadata', f'timestamp.json')):
        curr_timestamp = Metadata[Timestamp].from_file(os.path.join(DB_ROOT_PATH, 'image', 'metadata', f'timestamp.json'))
        curr_snapshot_ver = curr_timestamp.signed.snapshot_meta.version
        curr_snapshot = Metadata[Snapshot].from_file(os.path.join(DB_ROOT_PATH, 'image', 'metadata', f'{curr_snapshot_ver}.snapshot.json'))
        curr_target_ver = curr_snapshot.signed.meta['targets.json'].version

        return {
            'timestamp': curr_timestamp.signed.version,
            'snapshot': curr_snapshot_ver,
            'targets': curr_target_ver,
        }
    else: 
        return {
            'timestamp': 0,
            'snapshot': 0,
            'targets': 0,
        }


'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
BUSINESS LOGIC
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''


def init_image_repo():

    root = Metadata(Root(expires=_in(365)))
    root.signed.add_key(Key.from_securesystemslib_key(image_targets_key), 'targets')
    root.signed.add_key(Key.from_securesystemslib_key(image_snapshot_key), 'snapshot')
    root.signed.add_key(Key.from_securesystemslib_key(image_timestamp_key), 'timestamp')
    root.signed.add_key(Key.from_securesystemslib_key(image_root_key), 'root')
    root.sign(SSlibSigner(image_root_key))
    root.to_file(os.path.join(DB_ROOT_PATH, 'image', 'metadata', 'root.json'), serializer=JSONSerializer(compact=False))

    put_target('init.txt', 'init_content', 'image')
    
    return {}

def init_director_repo():

    root = Metadata(Root(expires=_in(365)))
    root.signed.add_key(Key.from_securesystemslib_key(director_targets_key), 'targets')
    root.signed.add_key(Key.from_securesystemslib_key(director_snapshot_key), 'snapshot')
    root.signed.add_key(Key.from_securesystemslib_key(director_timestamp_key), 'timestamp')
    root.signed.add_key(Key.from_securesystemslib_key(director_root_key), 'root')
    root.sign(SSlibSigner(director_root_key))
    root.to_file(os.path.join(DB_ROOT_PATH, 'director', 'metadata', 'root.json'), serializer=JSONSerializer(compact=False))
    
    put_target('init.txt', 'init_content', 'director')
    
    return {}

def get_time_attestation(nonces):
    signed = {
        'nonces': nonces,
        'timestamp': _get_time(),
    }
    return {
        'signed': signed,
        'signatures': create_signature(timeserver_key, json.dumps(signed).encode())
    }

def find_vehicle(id):
    try:
        with open(os.path.join(DB_ROOT_PATH, 'vehicles', id), 'r') as f:
            return json.loads(f.read())
    except:
        return None

def create_vehicle(vin):
    vehicle = {
        'vin': vin,
        'ecus': [],
        'vehicle_manifests': [],
        'image': None
    }
    with open(os.path.join(DB_ROOT_PATH, 'vehicles', vin), 'w') as f:
        f.write(json.dumps(vehicle))
    
    # create a directory in 'director' to store metadata for each vehicle
    os.mkdir(os.path.join(DB_ROOT_PATH, 'director', vin))

    return vehicle

def list_vehicles():
    return os.listdir(os.path.join(DB_ROOT_PATH, 'vehicles'))

def add_ecu_to_vehicle(id, ecu_serial, public_key):
    vehicle = find_vehicle(id)

    if not vehicle:
        return {}

    ecu = {
        'ecu_serial': ecu_serial,
        'is_primary': True, # we only support primaries
        'public_key': public_key,
        'ecu_manifests': []
    }

    vehicle['ecus'].append(ecu)

    with open(os.path.join(DB_ROOT_PATH, 'vehicles', vehicle['vin']), 'w') as f:
        f.write(json.dumps(vehicle))

    return ecu

def list_targets():
    return os.listdir(os.path.join(DB_ROOT_PATH, 'targets'))

def get_target(id):
    with open(os.path.join(DB_ROOT_PATH, 'targets', id), 'r') as f:
        return f.read()

def get_director_repo_timestamp():
    with open(os.path.join(DB_ROOT_PATH, 'director', 'metadata', 'timestamp.json'), 'r') as f:
        return json.loads(f.read())

def get_image_repo_timestamp():
    with open(os.path.join(DB_ROOT_PATH, 'image', 'metadata', 'timestamp.json'), 'r') as f:
        return json.loads(f.read())

def get_director_repo_metadata(version, role):
    metadata_path = os.path.join(DB_ROOT_PATH, 'director', 'metadata', f'{version}.{role}.json')
    if os.path.isfile(metadata_path):
        with open(metadata_path, 'r') as f:
            return json.loads(f.read())
    else:
        return abort(404)

def get_image_repo_metadata(version, role):
    metadata_path = os.path.join(DB_ROOT_PATH, 'image', 'metadata', f'{version}.{role}.json')
    if os.path.isfile(metadata_path):
        with open(metadata_path, 'r') as f:
            return json.loads(f.read())
    else:
        return abort(404)

def put_target(name, content, repo_name):
    #Write the target file
    file_path = os.path.join(DB_ROOT_PATH, repo_name, 'targets', name)

    with open(file_path, 'w') as f:
        f.write(content)

    
    # Compute the current versions of each metadata files
    curr_meta_versions = get_metadata_versions(repo_name)

    # Create the new target metadata
    targets_metadata = None
    # If the director repo is creating the target, we need to put the ECU serial as a custom field
    if repo_name == 'director':
        targets_metadata = Metadata(Targets(
            expires=_in(7), 
            version=curr_meta_versions['targets'] + 1,
            unrecognized_fields={'custom': {'ecu_serial': TEST_ECU_SERIAL}}))
    else: 
        targets_metadata = Metadata(Targets(
            expires=_in(7),
            version=curr_meta_versions['targets'] + 1))

    targets_metadata.signed.targets[name] = TargetFile.from_file(name, file_path)
    targets_key = image_targets_key if repo_name == 'image' else director_targets_key
    targets_metadata.sign(SSlibSigner(targets_key))
    targets_metadata.to_file(os.path.join(DB_ROOT_PATH, repo_name, 'metadata', f'{targets_metadata.signed.version}.targets.json'), serializer=JSONSerializer(compact=False))

    
    #Create the new snapshot metadata
    snapshot_metadata = Metadata(Snapshot(
        expires=_in(7), 
        meta = {"targets.json": MetaFile(targets_metadata.signed.version) },
        version=curr_meta_versions['snapshot']+1))

    snapshot_key = image_snapshot_key if repo_name == 'image' else director_snapshot_key
    snapshot_metadata.sign(SSlibSigner(snapshot_key))
    snapshot_metadata.to_file(os.path.join(DB_ROOT_PATH, repo_name, 'metadata', f'{snapshot_metadata.signed.version}.snapshot.json'), serializer=JSONSerializer(compact=False))


    #Create the new timestamp metadata
    timestamp_metadata = Metadata(Timestamp(
        expires=_in(1), 
        snapshot_meta= MetaFile(snapshot_metadata.signed.version),
        version=curr_meta_versions['timestamp']+1))
    
    timestamp_key = image_timestamp_key if repo_name == 'image' else director_timestamp_key
    timestamp_metadata.sign(SSlibSigner(timestamp_key))
    timestamp_metadata.to_file(os.path.join(DB_ROOT_PATH, repo_name, 'metadata', f'timestamp.json'), serializer=JSONSerializer(compact=False))

    return {'message': f'new target written to {file_path}, and meta datafiles were updated'}

def assign_image_to_vehicle(vin, image_id):
    vehicle = find_vehicle(vin)

    if not vehicle:
        return {}
    
    # TODO check image exists

    vehicle['image'] = image_id

    with open(os.path.join(DB_ROOT_PATH, 'vehicles', vehicle['vin']), 'w') as f:
        f.write(json.dumps(vehicle))

    return vehicle

def process_vehicle_manifest(vin, manifest):
    vehicle = find_vehicle(vin)

    # add manifest to db
    # whether or not it's valid we want a history so we add it
    # ...

    # now we validate
    # NOTE this is a lot of code, implement this using a pipeline pattern in js

    # validate format is correct
    # verify signature of vehicle manifest
    # verify vin exists in invetory db
    # verify all ecus in manifest belong to this vehicle according to the inventory db
    # verify all ecus in the vehicle according to inventory db are in the manifest
    # verify signature of all ecu manifests
    # verify the installed images in the manifest correspond to the last set that were sent down
    # verify there were no attacks detected
    # verify the vehicle is commisionsed
    # verify the account is in good standing order

    # NOTE not bothered implementing this, well just check the vehicle exists for now, everything else passed
    if not vehicle:
        print('not found')
        return {}

    # pprint(manifest)


    # lets compute which images if any should be put on this vehicle
    if not vehicle['image']:
        print('no images have been assigned to this vehicle')
        print('not found')
        return {}



    # record that this image was instructed to be put on this vehicle at this time
    
    # create new tuf metadata for the ecus on this vehicle
    root = Metadata(Root(expires=_in(365)))
    root.signed.add_key(Key.from_securesystemslib_key(director_root_key), 'root')
    root.signed.add_key(Key.from_securesystemslib_key(director_targets_key), 'targets')
    root.signed.add_key(Key.from_securesystemslib_key(director_snapshot_key), 'snapshot')
    root.signed.add_key(Key.from_securesystemslib_key(director_timestamp_key), 'timestamp')

    targets = Metadata(Targets(expires=_in(7)))
    snapshot = Metadata(Snapshot(expires=_in(7)))
    timestamp = Metadata(Timestamp(expires=_in(1)))

    image_id = vehicle['image']
    image_path = os.path.join(DB_ROOT_PATH, 'targets', image_id)
    
    targets.signed.targets[image_id] = TargetFile.from_file(image_id, image_path)

    root.sign(SSlibSigner(director_root_key))
    targets.sign(SSlibSigner(director_targets_key))
    snapshot.sign(SSlibSigner(director_snapshot_key))
    timestamp.sign(SSlibSigner(director_timestamp_key))

    root.to_file(os.path.join(DB_ROOT_PATH, 'director', vin, f'{root.signed.version}.root.json'), serializer=JSONSerializer(compact=False))
    targets.to_file(os.path.join(DB_ROOT_PATH, 'director', vin, f'{targets.signed.version}.targets.json'), serializer=JSONSerializer(compact=False))
    snapshot.to_file(os.path.join(DB_ROOT_PATH, 'director', vin, f'{snapshot.signed.version}.snapshot.json'), serializer=JSONSerializer(compact=False))
    timestamp.to_file(os.path.join(DB_ROOT_PATH, 'director', vin, f'timestamp.json'), serializer=JSONSerializer(compact=False))

    return {}





'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
SERVER API
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''

# timeserver
@app.route('/timeserver/attestation', methods=['POST'])
def timeserver():
    nonces = request.get_json()['nonces']
    return get_time_attestation(nonces)

'''
# init director repo
@app.route('/director/init')
def init_director():
    return init_director_repo()

'''

# init image and director repos
@app.route('/init')
def init_repos():
    init_image_repo()
    init_director_repo()
    return 'OK'

# create and list vehicles
@app.route('/director/vehicles', methods=['GET', 'POST'])
def director_vehicles():
    if request.method == 'POST':
        vin = request.get_json()['vin']
        return create_vehicle(vin)

    elif request.method == 'GET':
        return list_vehicles()

# assign image to vehicle
@app.route('/director/assignments', methods=['POST'])
def director_vehicle_assignment():
    vin = request.get_json()['vin']
    image_id = request.get_json()['image_id']
    return assign_image_to_vehicle(vin, image_id)
    
# get single vehicle
@app.route('/director/vehicles/<id>')
def director_vehicle_single(id):
    return find_vehicle(id) or {}

# add ecu to vehicle
@app.route('/director/vehicles/<id>/ecus', methods=['POST'])
def director_vehicles_ecus(id):
    if request.method == 'POST':
        ecu_serial = request.get_json()['ecu_serial']
        public_key = request.get_json()['public_key']
        return add_ecu_to_vehicle(id, ecu_serial, public_key)

# accept manifest from primary
@app.route('/director/vehicles/<id>/manifest', methods=['POST'])
def director_vehicles_manifest(id):
    if request.method == 'POST':
        manifest = request.get_json()
        return process_vehicle_manifest(id, manifest)

# add and list target
@app.route('/image/targets', methods=['GET', 'POST'])
def image_targets():
    if request.method == 'POST':
        name = request.get_json()['name']
        content = request.get_json()['content']
        put_target(name, content, 'image')
        put_target(name, content, 'director')
        return 'ok'

    elif request.method == 'GET':
        return list_targets()

# download target content
@app.route('/image/targets/<id>')
def image_targets_single(id):
    return get_target(id)

# download director repo metadata
@app.route('/director/<metadata>.json')
def director_metadata(metadata):
    if metadata =='timestamp':
        return get_director_repo_timestamp()
    else:
        version = metadata.split('.')[0]
        role = metadata.split('.')[1]
        return get_director_repo_metadata(version, role)

# download image repo metadata
@app.route('/image/<metadata>.json')
def image_metadata(metadata):
    if metadata =='timestamp':
        return get_image_repo_timestamp()
    else:
        version = metadata.split('.')[0]
        role = metadata.split('.')[1]
        return get_image_repo_metadata(version, role)


@app.route('/resign-timestamp')
def resign_timestamp():

    prev_timestamp_version = Metadata[Timestamp].from_file(os.path.join(DB_ROOT_PATH, 'image', 'metadata', f'timestamp.json')).signed.version
  
    image_timestamp_metadata = Metadata(Timestamp(expires=_in(1), version=prev_timestamp_version+1))
    image_timestamp_metadata.sign(SSlibSigner(image_timestamp_key))
    image_timestamp_metadata.to_file(os.path.join(DB_ROOT_PATH, 'image', 'metadata', f'timestamp.json'), serializer=JSONSerializer(compact=False))

    director_timestamp_metadata = Metadata(Timestamp(expires=_in(1), version=prev_timestamp_version+1))
    director_timestamp_metadata.sign(SSlibSigner(director_timestamp_key))
    director_timestamp_metadata.to_file(os.path.join(DB_ROOT_PATH, 'director', 'metadata', f'timestamp.json'), serializer=JSONSerializer(compact=False))
    
    return { 'timestamp_version': prev_timestamp_version + 1 }


'''''''''''''''''''''''''''''''''''''''''''''''''''''''''
SPACE TIME
'''''''''''''''''''''''''''''''''''''''''''''''''''''''''


if __name__ == '__main__':
    app.run(debug=True)