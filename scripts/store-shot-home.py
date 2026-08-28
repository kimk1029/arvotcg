#!/usr/bin/env python3
"""홈 화면 스토어 캡처 — 히어로 배너 1번 슬라이드(카드쇼, 네이비)가 완전히 정지·로드된 프레임만 저장.
사용: python3 scripts/store-shot-home.py store-assets/shots-v3/raw-real/01-home.png (에뮬레이터 emulator-5554)
"""
import subprocess, time, sys, io
from PIL import Image
A=['adb','-s','emulator-5554']
def cap():
    b=subprocess.run(A+['exec-out','screencap','-p'],capture_output=True).stdout
    return Image.open(io.BytesIO(b)).convert('RGB')
def navy(p): return p[0]<40 and p[1]<45 and p[2]<80
def ok(im):
    # 배너 영역(y≈190~560): 좌우 끝 열이 모두 네이비(슬라이드1 정지) + 금색 텍스트 픽셀 존재(이미지 로드됨)
    W,H=im.size
    for y in range(330,720,20):
        if not navy(im.getpixel((3,y))) or not navy(im.getpixel((W-4,y))): return False
    gold=0
    for y in range(330,720,6):
        for x in range(300,800,6):
            r,g,b=im.getpixel((x,y))
            if r>200 and g>130 and b<90: gold+=1
    return gold>40
subprocess.run(A+['shell','am','force-stop','com.arvotcg.app'])
subprocess.run(A+['shell','monkey','-p','com.arvotcg.app','-c','android.intent.category.LAUNCHER','1'],capture_output=True)
t0=time.time()
while time.time()-t0<40:
    im=cap()
    if ok(im):
        # 안정 확인: 0.4초 뒤에도 동일 조건이면 정지 상태
        time.sleep(0.4); im2=cap()
        if ok(im2):
            im2.save(sys.argv[1]); print('captured at', round(time.time()-t0,1),'s'); sys.exit(0)
    time.sleep(0.3)
print('FAILED'); sys.exit(1)
