# Background workers

## The rollout processor

TODO

## The TUF resigner

TODO

## The resource purger

For most resources, we can delete them in the web server controller because they do not take long or don't have a complex temporal consideration. For those sources that do, there's the resource purger.

Resources it purges:
- blob storage "directories" (object previxes) - because it takes a long time to delete.
- revoked certificates - because certificate revocation needs a serial, but we don't have a serial until a cert is downloaded. A team may be deleted while the certiciate has been issued but not downloaded, meaning we don't have the serial, meaning we can't revoke it.
- expired certificates - doesn't actuallly delete anything, just updates the status of the certificate in our db to expired
- expired provisioning credentials
- resources that are subject to a retention period (tuf metadata, robot manifests, ecu telemetry)

When web servers want to delete one of these resources it puts it on a queue and when the purger runs it takes one from it and tries to delete it, it's goal in life is to get the length of queue to zero

There is of course a time between when a web server "deletes" a resource and when the purger deletes it when the resource is still active, e.g. a certificate can still be used to authenticate.

### Events

**Delete a robot** 
The web server puts the id of robot cert in the bin.

**Revoke provisioning credential** 
The web server puts the id of client_auth cert in the bin.
The web server puts the id of provisioning cert in the bin.

**Delete team**
The web server puts the blob storage directory for that team in the bin.
For every robot the web server does the above
For every provisioning credential the web server does the above.

**Certificate expiry**
No action is required for a user for this event to trigger. The worker checks when a certificate is due to expire, if that time has elapsed it updates its status to expired.

**Provisioning credentials expiry**
No action is required from a user for this event to trigger. The worker checks when both of the certificates in a provisioning credential expires, if the time for one of them has elapsed it updates its status to expired (this time should be the same for both).

**Retention period**
No action is required from a user for this event to trigger. The worker checks for any resources that have exceeded the retention period and deletes them.