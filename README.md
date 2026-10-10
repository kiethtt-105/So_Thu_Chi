# Sổ Thu Chi
Web app thu chi (GitHub Pages) + Google Sheet + Apps Script.

## Triển khai
1. Import `SO_THU_CHI_MOI.xlsx` vào Google Sheet (Replace spreadsheet).
2. Sheet > Extensions > Apps Script: dán `apps-script/Code.gs`, Deploy > Manage deployments > Edit > Version: New version > Deploy (giữ nguyên URL /exec, Execute as: Me, Access: Anyone).
3. Đổi mật khẩu: Project Settings > Script properties > thêm `APP_PASS`. Mặc định 0000.
4. Đẩy `index.html`, `.nojekyll`, `README.md` lên repo, Settings > Pages > Deploy from branch (main, /root).
