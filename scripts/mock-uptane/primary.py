import os
from tuf.ngclient import Updater
from tuf.api.exceptions import RepositoryError
from securesystemslib.formats import encode_canonical
from securesystemslib.keys import create_signature
import requests 
from common import load_pem_key, generate_priv_tuf_key, _get_time
import hashlib
from styles import GREEN, RED, YELLOW, ENDCOLORS
import time
import json 
import uuid
from pprint import pprint
import sys

METADATA_EXTENSION = '.json'

NAMESPACE = 'seed'
ROBOT_ID = 'seed-robot'
PRIMARY_ECU_SERIAL = 'seed-primary-ecu'
SECONDARY_ECU_SERIAL = 'seed-secondary-ecu'
KEY_ROOT_PATH = os.path.abspath(os.path.join(os.path.dirname( __file__ ), '..', '..', 'uptane', 'keys'))


IMAGE_REPO_PORT = 8001
IMAGE_REPO_HOST = f'http://localhost:{IMAGE_REPO_PORT}/api/v0/image/{NAMESPACE}'

DIRECTOR_REPO_PORT = 8001
DIRECTOR_REPO_HOST = f'http://localhost:{DIRECTOR_REPO_PORT}/api/v0/director/{NAMESPACE}'


IMAGE_REPO_NAME = 'image-repo'
IMAGE_REPO_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'primary-fs', IMAGE_REPO_NAME)
IMAGE_REPO_META_DIR = os.path.join(IMAGE_REPO_DIR, 'metadata')
IMAGE_REPO_TARGETS_DIR = os.path.join(IMAGE_REPO_DIR, 'targets')

DIRECTOR_REPO_NAME = 'director-repo'
DIRECTOR_REPO_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'primary-fs', DIRECTOR_REPO_NAME)
DIRECTOR_REPO_META_DIR = os.path.join(DIRECTOR_REPO_DIR, 'metadata')
DIRECTOR_REPO_TARGETS_DIR = os.path.join(DIRECTOR_REPO_DIR, 'targets')



'''

---------------------------------------------------------------------------------------------------------------

ASSUMPTIONS 
* Primary Key pair has been generated 
* Director knows about this primary and it's associated robot
* timeserver key available

---------------------------------------------------------------------------------------------------------------

PREREQUISITES (Full verification ECUs) [Uptane Spec 5.4.1]
1. A sufficiently recent copy of required Uptane metadata at the time of manufacture or install.
    a) SHALL have a complete set of metadata (Root, Targets, Snapshot, and Timestamp) from **both** repositories 
      (Director & Image)
    b) A list of repository names and one or more URLs at which the named repository can be accessed. 
       At a minimum, this SHALL include the Director and Image repositories
2. Current time OR secure attestation of a sufficiently recent time
3. An ECU signing key. This is a private key, unique to the ECU, used to sign ECU version reports and decrypt 
  images


PREREQUISITE DATA
* ECU private key - MUST BE AVAILBE FOR THE PRIMARY CLIENT TO READ AT `db/keys/primary.json`
* Timeserver public key 
* Currently installed version 
* On first run (new installation), the Root metadata from both the Image and Director repositories. T
* On subsequent runs,  The most recent Root, Timestamp, Targets, and Snapshot metadata from both the Image and 
  Director repositories

---------------------------------------------------------------------------------------------------------------

WHAT DOES THE PRIMARY DO
A Primary downloads, verifies, and distributes the latest time, metadata, and images. To do so, it SHALL 
perform the following seven steps:
1. Construct and send vehicle version manifest                      [✓]
2. Download and check current time                                  [✓] 
3. Download and verify metadata                                     [1/2]    
4. Download and verify images                                       [✓]  
5. Send latest time to Secondaries                                  []
6. Send metadata to Secondaries                                     []
7. Send images to Secondaries                                       []

---------------------------------------------------------------------------------------------------------------

1 CONSTRUCT AND SEND THE MANIFEST 

[Uptane Spec 5.4.2.1]
* The Primary SHALL build a vehicle version manifest.
* Once the complete manifest is built, the Primary CAN send the manifest to the Director repository.
* However, it is not strictly required that the Primary send the manifest until step three of 
  'WHAT DOES THE PRIMARY DO'

[Uptane Spec 5.4.2.1.1]
The vehicle version manifest is a metadata structure that SHALL contain the following information
  1 signatures: a signature of the payload by the primacy 
  2 payload: 
    * VIN
    * The Primary ECUs unique identifier 
    * A list of ECU version reports. One of which SHOULD be the version report for the Primary itself. The
      others will be for each secondary ECU

[Uptane Spec 5.4.2.1.2]
An ECU version report is a metadata structure that SHALL contain the following information:
  1 Signatures: a signature of the payload by the corresponding ECU
  2 payload:
    * The ECUs unique identifier
    * The filename, length, and hashes of its currently installed image
    * An indicator of any detected security attack
    * The latest time the ECU can verify at the time this version report was generated
    * A nonce or counter to prevent a replay of the ECU version report. This value SHALL change each update 
      cycle.

---------------------------------------------------------------------------------------------------------------

2 DOWNLOAD AND CHECK CURRENT TIME 

[Uptane Spec 5.4.2.2]
The Primary SHALL load the current time from a secure source.

---------------------------------------------------------------------------------------------------------------

3 DOWNLOAD AND VERIFY METADATA

[Uptane Spec 5.4.4.2]
The Primary SHALL download metadata for all targets and perform a full verification on it.

The repository mapping metadata SHALL be consulted to determine where to download metadata from.

ECU checks that the Targets metadata about images from the Director repository matches the Targets metadata 
about the same images from the Image repository.

Substeps
1. Load and verify the current time or the most recent securely attested time.
2. Download and check the Root metadata file from the Director repository [Uptane Spec 5.4.4.3].
3. Download and check the Timestamp metadata file from the Director repository [Uptane Spec 5.4.4.4].
4. Check the previously downloaded Snapshot metadata file from the Directory repository (if available). If the 
   hashes and version number of that file match the hashes and version number listed in the new Timestamp 
   metadata, there are no new updates and the verification process SHALL be stopped and considered complete. 
   Otherwise, download and check the Snapshot metadata file from the Director repositor [Uptane Spec 5.4.4.5].
5. Download and check the Targets metadata file from the Director repository [Uptane Spec 5.4.4.6].
6. If the Targets metadata from the Directory repository indicates that there are no new targets that are not 
   already currently installed, the verification process SHALL be stopped and considered complete. 
   Otherwise, download and check the Root metadata file from the Image repository [Uptane Spec 5.4.4.3].
7. Download and check the Timestamp metadata file from the Image repository [Uptane Spec 5.4.4.4].
8. Check the previously downloaded Snapshot metadata file from the Image repository (if available). If the 
   hashes and version number of that file match the hashes and version number listed in the new Timestamp 
   metadata, the ECU SHALL skip to the last step. Otherwise, download and check the Snapshot metadata file from
   the Image repository [Uptane Spec 5.4.4.5].
9. Download and check the top-level Targets metadata file from the Image repository [Uptane Spec 5.4.4.6].

At this stage, we have the lastest metadata file sets from the image and director repo.

10. Verify that Targets metadata from the Director and Image repositories match. A Primary ECU SHALL perform
    this check on metadata for all images listed in the Targets metadata file from the Director repository 
    downloaded in step 6. To check that the metadata for an image matches, complete the following procedure: 

---------------------------------------------------------------------------------------------------------------

4 DOWLNOAD AND VERIFY IMAGES
[Uptane Spec 5.4.2.4]

The Primary SHALL download and verify images for itself and for all of its associated Secondaries. Images SHALL 
be verified by checking that the hash of the image file matches the hash specified in the Directors Targets 
metadata for that image.

---------------------------------------------------------------------------------------------------------------

5. SEND LATEST TIME TO SECONDARIES 


---------------------------------------------------------------------------------------------------------------

6. SEND METADATA TO SECONDARIES 


---------------------------------------------------------------------------------------------------------------

7. SEND IMAGES TO SECONDARIES


---------------------------------------------------------------------------------------------------------------

'''


class Primary():

  def __init__(self):


    self.director_updater = Updater(
        metadata_dir=DIRECTOR_REPO_META_DIR,
        target_dir=DIRECTOR_REPO_TARGETS_DIR,
        metadata_base_url=DIRECTOR_REPO_HOST,
        target_base_url='http://localhost:3001')

    self.image_updater = Updater(
        metadata_dir=IMAGE_REPO_META_DIR,
        target_dir=IMAGE_REPO_TARGETS_DIR,
        metadata_base_url=IMAGE_REPO_HOST,
        target_base_url='http://localhost:3001')

  

  def generate_signed_vehicle_manifest(self):
      """
      Creates ECU manifest that complies with Uptane Spec 5.4.2.1
      """

      def generate_ecu_version_report(ecu_serial, priv_tuf_key, file_name, file_body):
        
        ecu_report = {
          'signatures': [],
          'signed': {
            'ecu_serial': ecu_serial,
            'time': _get_time(),
            'nonce': str(uuid.uuid4()),
            'attacks_detected': '',
            'installed_image': {
              'filename': file_name,
              'length': len(file_body.encode('utf-8')),
              'hashes': {
                'sha256': hashlib.sha256(file_body.encode('utf-8')).hexdigest(),
                'sha512': hashlib.sha512(file_body.encode('utf-8')).hexdigest(),
              }
            } 
          }
        }
        
        report_signed_canonical = encode_canonical(ecu_report['signed'])
        report_signature = create_signature(priv_tuf_key, report_signed_canonical.encode('utf-8'))
        ecu_report['signatures'].append(report_signature)
        
        return ecu_report



      # Load the ECU private keys from pem files
      primary_ecu_key = load_pem_key(f'{NAMESPACE}-{PRIMARY_ECU_SERIAL}-private')
      secondary_ecu_key = load_pem_key(f'{NAMESPACE}-{SECONDARY_ECU_SERIAL}-private')

      primary_ecu_tuf_key = generate_priv_tuf_key(primary_ecu_key)
      secondary_ecu_tuf_key = generate_priv_tuf_key(secondary_ecu_key)

      # Init the robot manifest and generate the ecu version reports
      robot_manifest = {
        'signatures': [],
        'signed': {
          'vin': ROBOT_ID,
          'primary_ecu_serial': PRIMARY_ECU_SERIAL,
          'ecu_version_reports': {
            PRIMARY_ECU_SERIAL: generate_ecu_version_report(PRIMARY_ECU_SERIAL, primary_ecu_tuf_key, 'primary.txt', 'primary2'),
            SECONDARY_ECU_SERIAL: generate_ecu_version_report(SECONDARY_ECU_SERIAL, secondary_ecu_tuf_key, 'secondary.txt', 'secondary')
          }
        }
      }

      # Canonicalize the signed portion of the manifest
      manifest_signed_canonical = encode_canonical(robot_manifest['signed'])

      # Sign the signed portion of the manifest with the primarys keys
      manifest_signature = create_signature(primary_ecu_tuf_key, manifest_signed_canonical.encode('utf-8'))
      robot_manifest['signatures'].append(manifest_signature)
    
      return robot_manifest
    



  def submit_vehicle_manifest_to_director(self, signed_vehicle_manifest):
    
    #TODO check the signed_vehicle_manifest has valid schema

    url = f'{DIRECTOR_REPO_HOST}/robots/{ROBOT_ID}/manifests'

    try:
      res = requests.post(url, json = signed_vehicle_manifest)
      if res.status_code == 200:
        print(f'{GREEN}{str(res.status_code)} successfully sent vehicle manifest to the director {ENDCOLORS}') 
      else:
        print(f'{RED}HTTP {str(res.status_code)} while trying to send the vehicle manifest to the director{ENDCOLORS}') 
        print(f'{RED}Server error: {str(res.text)} {ENDCOLORS}') 

        # print(f'{RED} HTTP {str(res.message)} while trying to send the vehicle manifest to the director') 
    except requests.exceptions.RequestException:
      print(f'{RED}primary has blown up trying to submit vehicle manifest to director') 





  def get_signed_time(self, nonces):
    '''
    Forget about getting a correct signed time from a timeserver for now
    '''
    self.clock = _get_time()
    pass




  def refresh_toplevel_metadata(self):
    """
    For each repo download the TUF meta data. To start the only repos are 
    the director and image repo
    """
    
    #TODO potentially get metadata from other repos
    
    self.director_updater.refresh()
    self.image_updater.refresh()


  
  
  def get_target_list_from_director(self):
    # newer updater client lost the abilty to quickly grab
    # get_target_list_from_director from 0.9.8
    
    directed_targets = json.loads(self.director_updater._load_local_metadata('targets').decode())

    directed_targets_sanitised = []
    
    for filepath, fileinfo in directed_targets['signed']['targets'].items():
      new_target = {} 
      new_target['path'] = filepath 
      new_target['fileinfo'] = fileinfo
      new_target['fileinfo'] = fileinfo
      directed_targets_sanitised.append(new_target)

    return directed_targets_sanitised

    
    
    # validated_target_info will now look something like this:
    # {
    #   'Director': {
    #     filepath: 'django/django.1.9.3.tgz',
    #     fileinfo: {hashes: ..., length: ..., custom: {'ecu_serial': 'ECU1010101'} } },
    #   'ImageRepo': {
    #     filepath: 'django/django.1.9.3.tgz',
    #     fileinfo: {hashes: ..., length: ... } } }
    # }
  def get_validated_target_info(self, target_filepath):
    #TODO check if target from director repo matches target from image repo
    return True



  def update_cycle(self): 

    print('Starting update cycle')

    print('Fetching secure time')
    self.get_signed_time(nonces=[])
    print(f'{GREEN} Secure time fetched {ENDCOLORS}')

    print('Attempting to refresh image and director metadata files')
    try:
      self.refresh_toplevel_metadata()
    except Exception as e:
      print(f'{RED}{e}{ENDCOLORS}')
      return
    print(f'{GREEN}Metadata from director and image repo was fetched{ENDCOLORS}')

    directed_targets = self.get_target_list_from_director()

    if not directed_targets: 
      print(f'{YELLOW}No new targets to pull{ENDCOLORS}')

    else: 
      print(f'{GREEN}New targets to pull, attempting to verify{ENDCOLORS}')

      verified_targets = []

      # Validate each of the directed targets 
      for directed_target in directed_targets: 
        if self.get_validated_target_info(directed_target['path']):
          verified_targets.append(directed_target)
        else:
          print(RED + 'Director has instructed us to download a target (' +
            directed_target['filepath'] + ') that is not validated by the combination of '
            'Image + Director Repositories. That update IS BEING SKIPPED.' + ENDCOLORS)

      #TODO check if the custom attribute `ecu_serial` matches

      print(f'{GREEN}All new targets to pull have been verified successfully{ENDCOLORS}')
      
      for verified_target in verified_targets:
        print(f"{GREEN}Attempting to download target: {verified_target['path']}{ENDCOLORS}")

        # self.image_updater.download_target(verified_target, verified_target['path'])




    

    '''

    #Serialize the director targets from the fetched targets.json
    director_targets = self.tuf_updater.targets_of_role(
        rolename='targets', repo_name='director')

    if not director_targets:
      print('no targets from the director, dont need to update')
      return
    
    #The director metadata is reporting at least one target available
    #Now we need to validate if the target metadata from the images repo matches

    verified_targets = []

    for target_info in director_targets:
      try:
        verified_target = self.get_validated_target_info(target_info['filepath'])
        verified_targets.append(verified_target)
      except:
        print('the director repo target does not match the image repo target')


    for verified_target in verified_targets:

      #TODO butt load more checks and paths generator 
      path = 'i/hate/paths'
      
      self.tuf_updater.download_target(verified_target, path)
  '''




def main():

  print(f'{GREEN}Creating mocked primary client...{ENDCOLORS}')

  primary = Primary()

  actions = [
    '1. Inspect generated robot manifest',
    '2. Generate and send robot manifest',
    '3. Refresh top level metadata',
    '4. Run update cycle',
    '5. "Install" image on primary ECU',
    '6. "Install" image on secondary ECU',
    '7. "Report" detected attack on ECU'
  ]

  while True:
    # ask the user for an action
    action = input('\nWhat would you like to do ("q" to quit)?\n' + '\n'.join(actions) + '\n: ')
    if action == 'q':
      sys.exit(1)
    action_idx = 0
    try: 
      action_idx = (int(action))
    except ValueError:
      print(f'{RED}Please enter a number{ENDCOLORS}')
      continue
    if(action_idx < 1 or action_idx > len(actions)):
      print(f'{RED}Please enter a number between 1 and {str(len(actions))}{ENDCOLORS}')
      continue
    
    primary.get_signed_time([])

    #inspect generated manifests
    if action_idx == 1:
      print(f'{GREEN}The generated vehcile manifest is: {ENDCOLORS}')
      print(json.dumps(primary.generate_signed_vehicle_manifest(), indent=2))
      pass

    #generate and send manifest
    elif action_idx == 2:
      print(f'{GREEN}Attempting to send manifest to director{ENDCOLORS}')
      manifest = primary.generate_signed_vehicle_manifest()
      primary.submit_vehicle_manifest_to_director(manifest)


    #Refresh top level metadata
    elif action_idx == 3:
      print(f'{GREEN}Attempting to refresh top level metadata{ENDCOLORS}')
      primary.refresh_toplevel_metadata()
      pass

    #Run update cycle
    elif action_idx == 4:
      print(f'{GREEN}Attempting to run update cycle{ENDCOLORS}')
      pass

    #Change the 'installed' image on the primary
    elif action_idx == 5:
      print(f'{GREEN}Attempting to run update cycle{ENDCOLORS}')
      pass

    #Change the 'installed' image on the secondary
    elif action_idx == 6:
      print(f'{GREEN}Attempting to run update cycle{ENDCOLORS}')
      pass

    #Report an identified attack
    elif action_idx == 7:
      print(f'{GREEN}Attempting to run update cycle{ENDCOLORS}')
      pass

    else: 
      print('Unknown action')

  primary.get_signed_time([])

  #Send manifest to director
  manifest = primary.generate_signed_vehicle_manifest()

  primary.submit_vehicle_manifest_to_director(manifest)

  #Attempt an update cycles
  # primary.update_cycle()

  


if __name__ == '__main__':
    main()