<?php

// Web-root entry point. The backend code and config live outside the public folder:
//   ~/pickleball.buldov.com/api/index.php  (this file)
//   ~/pickleball-backend/                  (backend, vendor, config.php)
require dirname(__DIR__, 2) . '/pickleball-backend/public/index.php';
