# google-nftables

This a nodejs script which downloads the address ranges of Google servers, excludes the ip ranges of the Google cloud machines and generates nftables rules to allow inbound connections of the Google Services to your server.
Usefull when integrating Home Assistant or Nodered with Google Home.
The script can be scheduled by a cron.
