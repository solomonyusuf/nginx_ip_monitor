
# GoAccess Real-Time Dashboard with GeoIP on VPS

This guide explains how to set up **GoAccess** on a bare-metal VPS running **Nginx**, including **real-time HTML dashboard** and **GeoIP (Country, Region, City)** support. The setup runs perpetually via **systemd**.

---

## 1️⃣ Install Dependencies
```bash
sudo apt update
sudo apt install -y build-essential libncursesw5-dev libgeoip-dev libssl-dev
````

* Installs required libraries for GoAccess compilation and GeoIP support.

---

## 2️⃣ Compile and Install GoAccess

```bash
cd ~/goaccess/goaccess-1.9.4
sudo ./configure --enable-utf8 --enable-geoip=legacy
sudo make
sudo make install
```

* `--enable-geoip=legacy` allows GeoIP integration.
* `--enable-utf8` ensures proper Unicode display.

---

## 3️⃣ MaxMind Account

* **Account ID:** `12**906`
* **License Key:** `***xhp8ue_mmk***`
* Needed to download the **GeoLite2-City** database.

---

## 4️⃣ Download GeoLite2-City Database

```bash
cd /usr/share/GeoIP/
sudo wget "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=****&account_id=****&suffix=tar.gz" -O GeoLite2-City.tar.gz
sudo tar -xvzf GeoLite2-City.tar.gz
sudo cp GeoLite2-City_*/GeoLite2-City.mmdb ./
sudo rm -rf GeoLite2-City*
```

* Installs the GeoIP database at `/usr/share/GeoIP/GeoLite2-City.mmdb`.

---

## 5️⃣ Test GoAccess Command

```bash
sudo /usr/local/bin/goaccess /var/log/nginx/access.log \
  --log-format=COMBINED \
  --real-time-html \
  --ws-url=ws://YOUR_SERVER_IP:7890 \
  --origin=http://YOUR_SERVER_IP \
  --geoip-database /usr/share/GeoIP/GeoLite2-City.mmdb \
  --output=/var/www/html/goaccess/index.html
```

* Replace `YOUR_SERVER_IP` with your VPS public IP.
* Verify it outputs:

```
WebSocket server ready to accept new client connections
```

---

## 6️⃣ Run GoAccess Perpetually via systemd

Create the service file:

```bash
sudo nano /etc/systemd/system/goaccess.service
```

Paste the following:

```ini
[Unit]
Description=GoAccess Real-Time Log Analyzer
After=network.target nginx.service

[Service]
ExecStart=/usr/local/bin/goaccess /var/log/nginx/access.log \
  --log-format=COMBINED \
  --real-time-html \
  --ws-url=ws://YOUR_SERVER_IP:7890 \
  --origin=http://YOUR_SERVER_IP \
  --geoip-database /usr/share/GeoIP/GeoLite2-City.mmdb \
  --output=/var/www/html/goaccess/index.html
WorkingDirectory=/var/www/html/goaccess
Restart=always
RestartSec=5
User=root
StandardOutput=append:/var/log/goaccess.log
StandardError=append:/var/log/goaccess.err

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable goaccess
sudo systemctl start goaccess
sudo systemctl status goaccess
```

* GoAccess now runs **perpetually**, survives reboots, and restarts automatically if it fails.

---

## 7️⃣ Access the Dashboard

Open in browser:

```
http://YOUR_SERVER_IP/goaccess/
```

* Shows **real-time analytics** with **country, region, and city** info.

---

## 8️⃣ Optional Enhancements

* **Log rotation**: Prevents oversized Nginx logs from crashing GoAccess.
* **HTTPS / WSS**: Secure WebSocket connections for dashboards on HTTPS.
* **Nginx log modification**: Store country/state info directly in logs for faster GeoIP lookups.

---

## ✅ Notes

* Replace `YOUR_SERVER_IP` with your VPS public IP.
* Logs are available in `/var/log/goaccess.log` and errors in `/var/log/goaccess.err`.
* This setup assumes Nginx is already installed and logging in **Combined format**.

---


