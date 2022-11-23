import { prismaMock } from './../singleton';
import { robotManifestChecks } from '../../src/modules/director-repo/index'
import { IRobotManifest } from '../../src/types';
import { ManifestErrors } from '../../src/core/consts/errors';
import { Ecu, Robot, RobotManifest } from '@prisma/client';

const mockedNamespaceID = 'test';
const mockedEcuSerials = ['p1', 's1', 's2'];

const mockedRobot: Robot & { ecus: Ecu[]; robot_manifests: RobotManifest[]; } = {
  id: '1',
  namespace_id: mockedNamespaceID,
  created_at: new Date(),
  updated_at: new Date(),
  ecus: [],
  robot_manifests: []
}

//We'll re-init this before each test runs
let mockedManifest: IRobotManifest;


beforeEach(() => {

  mockedManifest = {
    signatures: [
      {
        sig: "",
        keyid: ""
      }
    ],
    signed: {
      vin: "",
      primary_ecu_serial: "s1",
      ecu_version_reports: {
        "s1": {
          signatures: [
            {
              sig: "",
              keyid: ""
            }
          ],
          signed: {
            ecu_serial: "s1",
            time: 0,
            attacks_detected: "",
            nonce: "",
            installed_image: {
              filename: "test.txt",
              length: 10,
              hashes: {
                sha256: "",
                sha512: "",
              }
            }
          }
        }
      }
    }
  }

});




test('should return robot not found', async () => {

  prismaMock.robot.findUnique.mockRejectedValue(ManifestErrors.RobotNotFound);
  
  await expect(robotManifestChecks(mockedManifest, mockedNamespaceID, mockedEcuSerials))
    .rejects.toEqual(ManifestErrors.RobotNotFound);

});


test('should return key not found', async () => {

  prismaMock.robot.findUnique.mockResolvedValue(mockedRobot);
  
  await expect(robotManifestChecks(mockedManifest, mockedNamespaceID, mockedEcuSerials))
    .rejects.toEqual(ManifestErrors.KeyNotLoaded);

});