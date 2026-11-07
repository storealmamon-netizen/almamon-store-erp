@echo off
chcp 65001 >nul
title نظام ومتجر المأمون الإلكتروني الحديث - النسخة السحابية والمحلية
echo ===============================================================================
echo   مرحباً بك في منظومة متجر المأمون الإلكتروني الحديث (الإدارة + الكاشير + المتجر)
echo   المالك: مأمون علي حمود العمري - تعز الحوبان (781002020 / 731002020)
echo ===============================================================================
start "" msedge --app="https://almamon-store.storealmamon.workers.dev/?mode=admin" 2>nul || start "" chrome --app="https://almamon-store.storealmamon.workers.dev/?mode=admin" 2>nul || start "" "%~dp0index.html"
