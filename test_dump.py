import paramiko, time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('132.243.67.110', username='root', password='UGnHniZGbdu33I0H')

stdin, stdout, stderr = ssh.exec_command('tcpdump -i any -n -c 5 udp port 8443 or tcp port 2443 & sleep 4; killall tcpdump 2>/dev/null || true')
print(stdout.read().decode('utf-8', errors='replace'))

ssh.close()
