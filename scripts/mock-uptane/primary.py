import os
from tuf.ngclient import Updater
from tuf.api.exceptions import RepositoryError
from securesystemslib.formats import encode_canonical
from securesystemslib.keys import create_signature
import requests 
from common import _load_key, pretty_dict
import hashlib
from styles import GREEN, RED, YELLOW, ENDCOLORS
import time
import json 

METADATA_EXTENSION = '.json'

IMAGE_REPO_PORT = 5000
IMAGE_REPO_HOST = f'http://localhost:{IMAGE_REPO_PORT}/image'

DIRECTOR_REPO_PORT = 5000
DIRECTOR_REPO_HOST = f'http://localhost:{DIRECTOR_REPO_PORT}/director'


IMAGE_REPO_NAME = 'image-repo'
IMAGE_REPO_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'primary-fs', IMAGE_REPO_NAME)
IMAGE_REPO_META_DIR = os.path.join(IMAGE_REPO_DIR, 'metadata')
IMAGE_REPO_TARGETS_DIR = os.path.join(IMAGE_REPO_DIR, 'targets')

DIRECTOR_REPO_NAME = 'director-repo'
DIRECTOR_REPO_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'primary-fs', DIRECTOR_REPO_NAME)
DIRECTOR_REPO_META_DIR = os.path.join(DIRECTOR_REPO_DIR, 'metadata')
DIRECTOR_REPO_TARGETS_DIR = os.path.join(DIRECTOR_REPO_DIR, 'targets')

VIN = 'batmobile'
ECU_SERIAL = 'ECU1234'
KEY_ROOT_PATH = os.path.abspath(os.path.join(os.path.dirname( __file__ ), '..', '..', 'uptane', 'keys'))

'''

---------------------------------------------------------------------------------------------------------------

ASSUMPTIONS 
* Primary Key pair has been generated 
* Director knows about this primary and it's associated vehicle
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

  def __init__(self, vin, ecu_serial, timeserver_public_key):
    self.vin = vin
    self.ecu_serial = ecu_serial
    self.timeserver_public_key = timeserver_public_key

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

      def generate_primary_ecu_version_report(primary_key):
        
        payload = {
          'ecu_serial': self.ecu_serial,
          'current_time': str(self.clock),
          'attacks_detected': '',
          'nonce': '', # TODO
          'installed_image': {
            'filename': '',
            'length': '',
            'hashes': {
              'sha256': '',
              'sha512': '',
            }
          }
        }

        # The installed image is simply the last updated file in the installed imgage directory
        os.chdir(IMAGE_REPO_TARGETS_DIR)
        installed_images = sorted(filter(os.path.isfile, os.listdir('.')), key=os.path.getmtime)

        if len(installed_images) != 0: 
          payload['installed_image']['filename'] = installed_images[-1]
          payload['installed_image']['length'] = os.path.getsize(f'{IMAGE_REPO_TARGETS_DIR}/{installed_images[-1]}')
          
          with open(os.path.join(IMAGE_REPO_TARGETS_DIR, installed_images[-1]), 'rb') as f:
            file_bytes = f.read()
            payload['installed_image']['hashes']['sha256'] = hashlib.sha256(file_bytes).hexdigest()
            payload['installed_image']['hashes']['sha512'] = hashlib.sha512(file_bytes).hexdigest()
            

        payload_canonical = encode_canonical(payload).encode('utf-8')
        payload_signature = create_signature(primary_key, payload_canonical)
        return {
          'signatures': [payload_signature],
          'signed': payload
        }


      primary_tuf_key = _load_key('primary')

      vehicle_manifest_payload = {
        'vin': self.vin,
        'primary_ecu_serial': self.ecu_serial,
        'ecu_version_manifests': {
          self.ecu_serial: generate_primary_ecu_version_report(primary_tuf_key)
        } # forget about secondary ECUs for the time being
      }

      # Canonicalize the signed portion of the manifest
      vehicle_manifest_payload_canonical = encode_canonical(vehicle_manifest_payload).encode('utf-8')

      # Sign the signed portion of the manifest with the primarys keys
      vehicle_manifest_signature = create_signature(primary_tuf_key, vehicle_manifest_payload_canonical)

      vehicle_manifest = {
        'signatures': [vehicle_manifest_signature],
        'signed': vehicle_manifest_payload,
      }

      return vehicle_manifest
    



  def submit_vehicle_manifest_to_director(self, signed_vehicle_manifest):
    
    #TODO check the signed_vehicle_manifest has valid schema

    url = f'{DIRECTOR_REPO_HOST}/vehicles/{VIN}/manifest'

    try:
      res = requests.post(url, json = signed_vehicle_manifest)
      if res.status_code == 200:
        print(f'{GREEN}{str(res.status_code)} successfully sent vehicle manifest to the director {ENDCOLORS}') 
      else:
        print(f'{RED} HTTP {str(res.status_code)} while trying to send the vehicle manifest to the director') 
    except requests.exceptions.RequestException:
      print(f'{RED}primary has blown up trying to submit vehicle manifest to director') 





  def get_signed_time(self, nonces):
    '''
    Forget about getting a correct signed time from a timeserver for now
    '''
    self.clock = time.time()
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
    # battle of the chimps, newer updater client lost the abilty to quickly grab
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
  primary = Primary(
    VIN, 
    ECU_SERIAL,
   _load_key('timeserver')
  )

  primary.get_signed_time([])

  #Send manifest to director
  manifest = primary.generate_signed_vehicle_manifest()
  primary.submit_vehicle_manifest_to_director(manifest)

  #Attempt an update cycles
  primary.update_cycle()

  


if __name__ == '__main__':
    main()