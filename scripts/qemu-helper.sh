'''
This script can be used if you are using the qemu emulator to
test on. It will obtain your local ip address and scp a /etc/hosts
file to qemu that maps localhost to local ip of the host.

without this the emulator will fail to provision itself as the 
autoprov.url is set to localhost during development
'''


user_home="/home/$USER"

#remove any existing for localhost 2222
ssh-keygen -f "$user_home/.ssh/known_hosts" -R "[localhost]:2222"

# get the hosts internal IP
local_ip=$(hostname -I | cut -d" " -f1)

echo -e "$local_ip\tlocalhost" > qemu-hosts.txt

scp -P 2222 qemu-hosts.txt root@localhost:/etc/hosts

rm qemu-hosts.txt