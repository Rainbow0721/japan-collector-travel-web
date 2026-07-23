"""從既有 OSM 快取挑選具官方／知識庫訊號的餐飲與購物候選。

用途是補足百科資料不擅長的店家層。產物固定為完成度 80%、不可自動排行程；
直到近期人氣、中文校名與營業價格逐筆核對後才可升為 100%。
"""
from __future__ import annotations
import glob,json,re
from collections import Counter,defaultdict
from pathlib import Path
from pykakasi import kakasi

ROOT=Path(__file__).resolve().parents[1]
CACHE=Path('/tmp/tabi-mate-osm-cache')
OUT=ROOT/'database'/'osm-food-shopping-80.json'
OUT_JS=ROOT/'places.osm-value.js'
REPORT=ROOT/'database'/'osm-value-report.json'
AREAS=['台東區','千代田區','中央區','新宿區','澀谷區','港區','豐島區','墨田區','江東區','文京區','目黑區','世田谷區','中野杉並','品川大田','東京北東區','東京西北區','東京都西側','鎌倉江之島','橫濱','箱根小田原','富士河口湖御殿場','日光','川越','輕井澤','千葉舞濱成田']
BLOCK=('starbucks','スターバックス','tully','タリーズ','mcdonald','マクドナルド','matsuya','松屋','yoshinoya','吉野家','sukiya','すき家','doutor','ドトール','kfc','ケンタッキー','モスバーガー','saizeriya','サイゼリヤ','marugame','丸亀製麺','ootoya','大戸屋','gindaco','築地銀だこ','sushiro','スシロー','くら寿司','はま寿司','コメダ','ジョナサン','ガスト','デニーズ','ロイヤルホスト','セブン','ローソン','ファミリーマート')
SHOP_ALLOW={'department_store','mall','gift','deli','bakery','confectionery','tea','coffee','cosmetics','clothes','shoes','jewelry','electronics','camera','books','stationery','toys','anime','variety_store','second_hand','musical_instrument','craft'}
FOOD_ALLOW={'restaurant','cafe','ice_cream','marketplace'}
romanizer=kakasi()

def point(e):return e.get('lat') or e.get('center',{}).get('lat'),e.get('lon') or e.get('center',{}).get('lon')
def romanize(s):return ' '.join(x['hepburn'] for x in romanizer.convert(s)).title()
def blocked(name):return any(x.casefold() in name.casefold() for x in BLOCK)
def clean_cuisine(value):
    c=(value or '日本料理').replace('_',' ').replace(';','／')
    mapping={'japanese':'日本料理','sushi':'壽司','ramen':'拉麵','coffee shop':'咖啡','soba':'蕎麥麵','barbecue':'燒肉／燒烤','western／japanese':'日本洋食','chinese':'中華料理','italian':'義大利料理','french':'法國料理','curry／japanese':'日式咖哩','ice cream':'冰品甜點','regional':'地方料理','noodle':'麵食'}
    return mapping.get(c.lower(),c)
def website(t):return t.get('website') or t.get('contact:website')

def main():
    rows=[];seen=set()
    for p in sorted(glob.glob(str(CACHE/'[0-9][0-9].json'))):
        idx=int(Path(p).stem)-1
        if idx>=len(AREAS):continue
        area=AREAS[idx]
        for e in json.load(open(p)):
            k=(e.get('type'),e.get('id'))
            if k in seen:continue
            seen.add(k);t=e.get('tags',{});name=t.get('name:ja') or t.get('name')
            lat,lng=point(e)
            if not name or lat is None or blocked(name):continue
            official=website(t);wd=t.get('wikidata')
            if t.get('amenity') in FOOD_ALLOW and t.get('cuisine'):kind='美食';sub=clean_cuisine(t.get('cuisine'))
            elif t.get('shop') in SHOP_ALLOW:kind='購物';sub=t.get('shop')
            else:continue
            en=t.get('name:en') or romanize(name)
            sourced_zh=t.get('name:zh-Hant') or t.get('name:zh')
            zh=sourced_zh or f'{en}（{sub}）'
            trace=('官方網站或 Wikidata 身分' if official or wd else '具體料理／店舖類型與 OSM 可追溯實體')
            reason=(f'提供{sub}這項明確料理目的，{trace}；適合先加入同區美食候選，再以 Tabelog、Google Maps 與近期旅客訊號決定是否值得排隊。' if kind=='美食' else f'屬於{sub}類購物地點，{trace}；適合核對限定商品、免稅、價差與台灣旅客購買目的後再升級推薦。')
            rows.append({'id':f"osm-value-{e['type']}-{e['id']}",'nameZhHant':zh,'nameJa':name,'nameEn':en,'nameStatus':'來源繁中' if sourced_zh else '羅馬字＋繁中類型暫名，待人工校名','category':kind,'subcategory':sub,'travelerIntent':kind,'travelerReason':reason,'intro':f'{zh}位於{area}。{reason}','areaCluster':area,'latitude':float(lat),'longitude':float(lng),'officialUrl':official,'sourceUrl':f"https://www.openstreetmap.org/{e['type']}/{e['id']}",'wikidata':f'https://www.wikidata.org/wiki/{wd}' if wd else None,'evidence':['OpenStreetMap ODbL',*(['官方網站'] if official else []),*(['Wikidata'] if wd else [])],'averageStayMinutes':75 if kind=='美食' else 90,'costNote':'依官方菜單／商品與當期價格；個人購物不計入基本旅費','openingHours':t.get('opening_hours') or '出發前查官方最新營業時間','lastVerifiedAt':'2026-07-24','completionScore':80,'recommendationEligible':False,'qualityReasons':['尚待近期人氣、繁中校名與營業價格逐筆核對；不自動排行程']})
    # 料理／購物類型與區域輪替，避免再被單一咖啡或服飾類灌滿。
    groups=defaultdict(list)
    for r in sorted(rows,key=lambda x:(not bool(x['officialUrl']),x['nameJa'])):groups[(r['category'],r['subcategory'])].append(r)
    selected=[]
    for category,target in [('美食',300),('購物',150)]:
        keys=[k for k in groups if k[0]==category]
        while len([x for x in selected if x['category']==category])<target and any(groups[k] for k in keys):
            for k in keys:
                if groups[k]:selected.append(groups[k].pop(0))
                if len([x for x in selected if x['category']==category])>=target:break
    OUT.write_text(json.dumps(selected,ensure_ascii=False,indent=2),encoding='utf-8')
    OUT_JS.write_text('// OSM ODbL；全部為完成度 80%，不得自動排行程。\nconst OSM_VALUE_PLACES='+json.dumps(selected,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    report={'candidates':len(rows),'selected':len(selected),'categories':Counter(x['category'] for x in selected),'subcategories':Counter(x['subcategory'] for x in selected),'areas':Counter(x['areaCluster'] for x in selected),'sourceChineseName':sum(x['nameStatus']=='來源繁中' for x in selected),'withOfficialUrl':sum(bool(x['officialUrl']) for x in selected)}
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2,default=dict),encoding='utf-8');print(json.dumps(report,ensure_ascii=False,default=dict))
if __name__=='__main__':main()
