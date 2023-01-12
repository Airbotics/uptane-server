import { Ecu, Robot, RobotManifest } from '@prisma/client';
import { prismaMock } from '../singleton';
import { robotManifestChecks } from '@airbotics-modules/director-repo'
import { IRobotManifest } from '@airbotics-types';
import { ManifestErrors } from '@airbotics-core/consts/errors';
import { ESignatureScheme } from '@airbotics-core/consts';

const mockedTeamID = 'test';
const mockedEcuSerials = ['p1', 's1', 's2'];

const mockedRobot: Robot & { ecus: Ecu[]; robot_manifests: RobotManifest[]; } = {
  id: '1',
  team_id: mockedTeamID,
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
        method: ESignatureScheme.RsassaPssSha256,
        keyid: ""
      }
    ],
    signed: {
      primary_ecu_serial: "s1",
      ecu_version_manifests: {
        "s1": {
          signatures: [
            {
              sig: "",
              method: ESignatureScheme.RsassaPssSha256,
              keyid: ""
            }
          ],
          signed: {
            ecu_serial: "s1",
            timeserver_time: '',
            previous_timeserver_time:'',
            attacks_detected: "",
            report_counter: 0,
            installed_image: {
              fileinfo: {
                hashes: {
                  sha256: ""
                },
                length: 0
              },
              filepath: ''
            }
          }
        }
      }
    }
  }

});




test('should return robot not found', async () => {

  prismaMock.robot.findUnique.mockRejectedValue(ManifestErrors.RobotNotFound);
  
  await expect(robotManifestChecks(mockedManifest, '', mockedTeamID, mockedEcuSerials))
    .rejects.toEqual(ManifestErrors.RobotNotFound);

});


test('should return key not found', async () => {

  prismaMock.robot.findUnique.mockResolvedValue(mockedRobot);
  
  await expect(robotManifestChecks(mockedManifest, '', mockedTeamID, mockedEcuSerials))
    .rejects.toEqual(ManifestErrors.KeyNotLoaded);

});