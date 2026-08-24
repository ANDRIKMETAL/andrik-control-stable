ANDRIK Radio R627 web remote control

Install on AWS after R627 is deployed to GitHub/main:
  sudo git -C /opt/andrik-radio fetch --depth 1 origin main && sudo git -C /opt/andrik-radio reset --hard origin/main && sudo bash /opt/andrik-radio/radio247/vm-lite/install-andrik-console-r627.sh

One-time pair:
1. Open https://andrikmetal.com/radio-control-admin.html
2. Click "Создать код подключения AWS"
3. Run the short command shown, e.g. sudo andrik-radio-web pair ABCD1234XY

After pairing, use the website buttons. No inbound EC2 control port is required.
