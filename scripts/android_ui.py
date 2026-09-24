"""Small semantic Android UI driver used by native smoke verification."""
import argparse
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
ADB = str(Path.home()/'Library/Android/sdk/platform-tools/adb')
def adb(*args):
    return subprocess.check_output([ADB,*args],text=True)
def snapshot():
    adb('shell','uiautomator','dump','/sdcard/dentpro-ui.xml')
    root=ET.fromstring(adb('shell','cat','/sdcard/dentpro-ui.xml'))
    return [n.attrib for n in root.iter('node')]
def show():
    for n in snapshot():
        if n.get('text') or n.get('content-desc'):
            print({k:n.get(k) for k in ('text','content-desc','class','bounds','enabled')})
def tap(label):
    for _ in range(4):
        nodes=snapshot()
        matches=[n for n in nodes if n.get('content-desc')==label or n.get('text')==label]
        if matches: break
    if not matches: raise RuntimeError('UI element not visible: '+label)
    node=next((n for n in matches if n.get('clickable')=='true'),matches[-1])
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node['bounds']))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['snapshot','tap','text','back','down','up','screenshot']);p.add_argument('value',nargs='?');a=p.parse_args()
    if a.action=='snapshot':show()
    elif a.action=='tap':tap(a.value)
    elif a.action=='text':adb('shell','input','text',a.value.replace(' ','%s'))
    elif a.action=='back':adb('shell','input','keyevent','4')
    elif a.action=='down':adb('shell','input','swipe','550','1700','550','700','350')
    elif a.action=='up':adb('shell','input','swipe','550','700','550','1700','350')
    elif a.action=='screenshot':
        Path(a.value).parent.mkdir(parents=True,exist_ok=True)
        Path(a.value).write_bytes(subprocess.check_output([ADB,'exec-out','screencap','-p']))
