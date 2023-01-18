import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { asyncExec, ls, pwd, rm, test } from 'async-shelljs';
import { StaticDeltaStatus, UploadStatus } from '@prisma/client';
import prisma from '@airbotics-core/drivers/postgres';
import { blobStorage } from '@airbotics-core/blob-storage';


// TODO reuse from treehub module
const uploadSummary = async (team_id: string, size: number, summaryContent: Buffer | string) => {

    const objectID = 'summary';

    await prisma.$transaction(async tx => {

        await tx.object.upsert({
            create: {
                team_id,
                object_id: objectID,
                size,
                status: UploadStatus.uploading
            },
            update: {
                size,
                status: UploadStatus.uploading
            },
            where: {
                team_id_object_id: {
                    team_id,
                    object_id: objectID
                }
            }
        });

        await blobStorage.putObject(team_id, 'treehub/summary', summaryContent);

        await tx.object.update({
            where: {
                team_id_object_id: {
                    team_id,
                    object_id: objectID
                }
            },
            data: {
                status: UploadStatus.uploaded
            }
        });

    });
}


/**
 * Generates an ostree delta between a `from` and a `to` commit.
 * 
 * TODO
 * - try catch on all shell commands
 * - check return code on all chell commands
 * - update delta status to failed if any command fails
 * - check ostree exists before attempting commands
 * - update the rollout to say its ready to be deployed
 */
export const generateStaticDelta = async (team_id: string, branch: string, from: string, to: string) => {

    const refName = `/heads/${branch}`;

    // name of temporary repo directory
    const repoName = randomUUID();
    
    // make sure we haven't generated this delta before or it is currently being generated
    const deltaObj = await prisma.staticDelta.findUnique({
        where: {
            team_id_from_to: {
                team_id,
                from: `${from}.commit`,
                to: `${to}.commit`
            }
        }
    });

    if (deltaObj && (deltaObj.status === StaticDeltaStatus.underway || deltaObj.status === StaticDeltaStatus.succeeded)) {
        console.log('this delta has already been generated');
        throw new Error();
    }


    // check from commit is good
    const fromCommit = await prisma.object.findUnique({
        where: {
            team_id_object_id: {
                team_id,
                object_id: `${from}.commit`
            }
        }
    });

    if (!fromCommit) {
        console.log('from commit does not exist');
        throw new Error();
    }

    if (fromCommit.status !== UploadStatus.uploaded) {
        console.log('from commit does not exist');
        throw new Error();
    }


    // check to commit is good
    const toCommit = await prisma.object.findUnique({
        where: {
            team_id_object_id: {
                team_id,
                object_id: `${to}.commit`
            }
        }
    });

    if (!toCommit) {
        console.log('to commit does not exist');
        throw new Error();
    }

    if (toCommit.status !== UploadStatus.uploaded) {
        console.log('to commit does not exist');
        throw new Error();
    }


    // check branch exists
    const ref = await prisma.ref.findUnique({
        where: {
            team_id_name: {
                team_id,
                name: refName
            }
        }
    })

    if (!ref) {
        console.log('branch does not exist');
        throw new Error();
    }


    // update the delta to say its underway
    await prisma.staticDelta.upsert({
        where: {
            team_id_from_to: {
                team_id,
                from: `${from}.commit`,
                to: `${to}.commit`
            }
        },
        update: {
            status: StaticDeltaStatus.underway
        },
        create: {
            from: `${from}.commit`,
            to: `${to}.commit`,
            team_id,
            status: StaticDeltaStatus.underway
        }
    });


    // clean the temporary local repo 
    if (test('-e', repoName)) {
        rm('-r', repoName);
    }

    // init the repo
    await asyncExec(`ostree init --repo ${repoName} --mode archive-z2`, { silent: true });

    // add the remote
    await asyncExec(`ostree remote add --force --repo ${repoName} --no-gpg-verify treehub http://localhost:8001/api/v0/robot/treehub/${team_id}`, { silent: true });

    // pull the repo
    await asyncExec(`ostree pull --repo ${repoName} --disable-static-deltas --disable-fsync --depth -1 treehub ${branch}`, { silent: true });

    // generate the delta
    await asyncExec(`ostree static-delta generate --repo ${repoName} --if-not-exists --from ${from} --to ${to}`, { silent: true });

    // upload deltas - recursively crawl through /deltas/*, read and push
    const prefixes = fs.readdirSync(repoName, { withFileTypes: true }).filter(item => item.isDirectory());

    for (const prefix of prefixes) {
        const prefixDir = path.join(repoName, prefix.name);
        const suffixes = fs.readdirSync(prefixDir, { withFileTypes: true }).filter(item => item.isDirectory());

        for (const suffix of suffixes) {
            const suffixDir = path.join(repoName, prefix.name, suffix.name);
            const files = fs.readdirSync(suffixDir, { withFileTypes: true }).filter(item => !item.isDirectory());

            for (const file of files) {

                const fileName = path.join(repoName, prefix.name, suffix.name, file.name);
                const deltaContent = fs.readFileSync(fileName, 'binary');
                const blobObjectId = `treehub/deltas/${prefix.name}/${suffix.name}/${file.name}`;
                await blobStorage.putObject('ffeec0ff-1041-4445-b174-b844eff37435',blobObjectId , deltaContent);

            }
        }
    }
    
    // compute the summary
    await asyncExec(`ostree summary --repo ${repoName} -u`, { silent: true });

    // read summary and size from file
    const summaryContent = fs.readFileSync(`${repoName}/summary`, 'binary');
    const size = Buffer.byteLength(summaryContent);

    // upload summary
    await uploadSummary(team_id, size, summaryContent);

    // clean the local repo
    rm('-r', repoName);

    // update status to say it has been generated
    await prisma.staticDelta.update({
        where: {
            team_id_from_to: {
                team_id,
                from: `${from}.commit`,
                to: `${to}.commit`
            }
        },
        data: {
            status: StaticDeltaStatus.succeeded
        }
    });

    // update the rollout to specify it is ready to be deployed
    // TODO

}