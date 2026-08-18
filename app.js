const KEY='jihyeonBudgetV1';
const seed={budgetMe:1000000,budgetMom:1000000,categories:['식비','카페','쇼핑','생활','교통','의료','미용','문화·여가','구독','보험','기타'],methods:[{n:'내 신용카드',owner:'me'},{n:'엄마카드',owner:'mom'},{n:'계좌이체',owner:'me'},{n:'체크카드',owner:'me'}],tx:[],fixed:[]};
let db=JSON.parse(localStorage.getItem(KEY)||'null')||structuredClone(seed), tab='home', calMonth=new Date().toISOString().slice(0,7), calExcludeMom=false;
db.categories ||= seed.categories; db.methods ||= seed.methods; db.tx ||= []; db.fixed ||= [];
if(!db.methods.some(x=>x.n==='체크카드')) db.methods.push({n:'체크카드',owner:'me'});
const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const won=n=>Number(n||0).toLocaleString('ko-KR')+'원';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function currentMonth(){return new Date().toISOString().slice(0,7)}
function monthTx(m=currentMonth()){return db.tx.filter(x=>x.date.startsWith(m))}
function sums(){let t=monthTx(), me=0,mom=0;t.forEach(x=>{let p=db.methods.find(p=>p.n===x.method);(p?.owner==='mom'?mom+=x.amount:me+=x.amount)});return{me,mom,t}}
function fixedTxId(f,m=currentMonth()){return `fixed:${f.id}:${m}`}
function fixedDate(f,m=currentMonth()){let [y,mo]=m.split('-').map(Number);let last=new Date(y,mo,0).getDate();return `${m}-${String(Math.min(+f.day,last)).padStart(2,'0')}`}
function renderFixedHome(){
  if(!db.fixed.length)return `<p class=muted>설정에서 고정비를 추가할 수 있어요.</p>`;
  return db.fixed.slice().sort((a,b)=>a.day-b.day).map(f=>{
    const tx=db.tx.find(x=>x.id===fixedTxId(f));
    const checked=!!tx;
    const amountText=checked
      ? `실제 ${won(tx.amount)} · 예상 ${won(f.amount)}`
      : `예상 ${won(f.amount)}`;
    return `<div class=fixeditem><label><input type=checkbox ${checked?'checked':''} onchange='toggleFixed(${JSON.stringify(f.id)},this.checked)'><span><b>${f.day}일 · ${esc(f.memo)}</b><br><span class=muted>${amountText} · ${esc(f.method)}</span></span></label></div>`;
  }).join('');
}
function renderCalendar(){
  const [y,m]=calMonth.split('-').map(Number);
  const lastDay=new Date(y,m,0).getDate();

  const allTx=monthTx(calMonth);
  const t=calExcludeMom
    ? allTx.filter(x=>{
        const p=db.methods.find(p=>p.n===x.method);
        return p?.owner!=='mom';
      })
    : allTx;

  const byDay={};
  t.forEach(x=>{
    const d=+x.date.slice(-2);
    byDay[d]=(byDay[d]||0)+Number(x.amount||0);
  });

  const total=t.reduce((s,x)=>s+Number(x.amount||0),0);
  const today=new Date().toISOString().slice(0,10);

  const weeks=[];
  let week=new Array(7).fill(null);

  for(let d=1; d<=lastDay; d++){
    const dow=new Date(y,m-1,d).getDay();
    week[dow]=d;
    if(dow===6 || d===lastDay){
      weeks.push(week);
      week=new Array(7).fill(null);
    }
  }

  const weeksHtml=weeks.map(days=>{
    const weekTotal=days.reduce((sum,d)=>sum+(d ? (byDay[d]||0) : 0),0);
    const daysHtml=days.map(d=>{
      if(!d) return `<div class="calDay blank"></div>`;
      const ds=`${calMonth}-${String(d).padStart(2,'0')}`;
      const amount=byDay[d]||0;
      return `
        <button class="calDay ${ds===today?'today':''}" onclick='showDay("${ds}")'>
          <span class="calDate">${d}</span>
          ${amount ? `<span class="calAmount">-${Number(amount).toLocaleString('ko-KR')}</span>` : `<span class="calAmount emptyAmount">&nbsp;</span>`}
        </button>`;
    }).join('');

    return `
      <div class="calendarWeek">
        <div class="weekDays">${daysHtml}</div>
        ${weekTotal ? `<div class="weekSummary"><span>주간 합계</span><b>-${Number(weekTotal).toLocaleString('ko-KR')}원</b></div>` : `<div class="weekSummary emptyWeek"><span></span><b></b></div>`}
      </div>`;
  }).join('');

  return `
    <section class="calendarPage">
      <div class="calendarTop">
        <button class="monthArrow" onclick='moveMonth(-1)' aria-label="이전 달">‹</button>
        <div class="monthTitle">
          <h1>${y}년 ${m}월</h1>
          <div class="monthSpend">월 총지출 <b>-${Number(total).toLocaleString('ko-KR')}원</b></div>
        </div>
        <button class="monthArrow" onclick='moveMonth(1)' aria-label="다음 달">›</button>
      </div>

      <div class="calendarFilterBar">
        <button class="${calExcludeMom?'active':''}" onclick='toggleCalendarMom()'>
          ${calExcludeMom?'✓ 엄마카드 제외 중':'엄마카드 제외해서 보기'}
        </button>
        ${calExcludeMom?`<span>내 지출만 표시 중</span>`:`<span>엄마카드 포함</span>`}
      </div>

      <div class="calendarBoard">
        <div class="weekdayRow">
          <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
        </div>
        ${weeksHtml}
      </div>

      <p class="calendarHint">날짜를 누르면 현재 필터 기준으로 그날의 지출 내역과 합계를 볼 수 있어요.</p>
    </section>`;
}


function backupStatusHtml(){
  const last=db.lastBackupAt ? new Date(db.lastBackupAt) : null;
  const now=new Date();

  if(!last || Number.isNaN(last.getTime())){
    return `<div class='backupNotice'><div><b>아직 백업하지 않았어요</b><div>가계부 데이터를 안전하게 보관해두세요.</div></div><button onclick='backup()'>지금 백업</button></div>`;
  }

  const days=Math.floor((now-last)/(1000*60*60*24));
  const dateText=last.toLocaleDateString('ko-KR');

  if(days>=7){
    return `<div class='backupNotice'><div><b>마지막 백업 후 ${days}일이 지났어요</b><div>마지막 백업 ${dateText}</div></div><button onclick='backup()'>지금 백업</button></div>`;
  }

  return `<div class='backupOk'><span>백업 완료</span><span>마지막 백업 ${dateText}</span></div>`;
}

function render(){
  let a=document.querySelector('#app');
  if(tab==='home'){
    let s=sums();
    a.innerHTML=`<h1>지현이의 가계부🤑</h1>${backupStatusHtml()}
    <div class=card><div class=muted>내 지출</div><div class=big>${won(s.me)} <span class=muted>/ ${won(db.budgetMe)}</span></div><div class=bar><i style='width:${Math.min(100,s.me/db.budgetMe*100)}%'></i></div><p>남은 금액 ${won(Math.max(0,db.budgetMe-s.me))}</p></div>
    <div class=card><div class=muted>엄마카드</div><div class=big>${won(s.mom)} <span class=muted>/ ${won(db.budgetMom)}</span></div><div class=bar><i style='width:${Math.min(100,s.mom/db.budgetMom*100)}%'></i></div><p>${s.mom>db.budgetMom?'<span class=danger>한도 초과 '+won(s.mom-db.budgetMom)+'</span>':'남은 한도 '+won(db.budgetMom-s.mom)}</p></div>
    <div class=card>
      <div class='fixedSummaryHead'>
        <div>
          <h3>이번 달 고정비</h3>
          <div class='muted'>등록된 총 고정비</div>
        </div>
        <div class='fixedSummaryAmount'>${won(db.fixed.reduce((s,f)=>s+Number(f.amount||0),0))}</div>
      </div>
      <div class='fixedPaidSummary'>
        <span>지출 처리됨</span>
        <b>${won(db.fixed.reduce((s,f)=>{const tx=db.tx.find(x=>x.id===fixedTxId(f));return s+(tx?Number(tx.amount||0):0)},0))}</b>
      </div>
      ${renderFixedHome()}
    </div>
    <div class=card><h3>최근 지출</h3>${s.t.slice(-5).reverse().map(x=>`<div class='row listitem'><span>${esc(x.memo||x.category)}<br><span class=muted>${esc(x.method)}</span></span><b>${won(x.amount)}</b></div>`).join('')||'<p class=muted>아직 기록이 없어요.</p>'}</div>`;
  } else if(tab==='history'){
    a.innerHTML=`<h1>내역</h1><div class=card>${db.tx.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<div class='row listitem historyItem' onclick='editTx("${x.id}")'><span>${esc(x.date)} · ${esc(x.category)}<br><span class=muted>${esc(x.method)} · ${esc(x.memo||'')}</span></span><span class='historyRight'><b>${won(x.amount)}</b><span class=editHint>수정 ›</span></span></div>`).join('')||'기록 없음'}</div>`;
  } else if(tab==='calendar'){
    a.innerHTML=renderCalendar();
  } else if(tab==='analysis'){
    let t=monthTx(), by={};
    t.forEach(x=>by[x.category]=(by[x.category]||0)+x.amount);
    let total=t.reduce((s,x)=>s+x.amount,0);
    a.innerHTML=`<h1>분석</h1>
    <div class=card><h3>카테고리별</h3>
      ${Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
        <button class='analysisRow' onclick='showAnalysisDetail("category",${JSON.stringify(k)})'>
          <span>${esc(k)}</span>
          <span>${won(v)} · ${total?Math.round(v/total*100):0}% <b class=chev>›</b></span>
        </button>`).join('')||'<p class=muted>이번 달 기록 없음</p>'}
    </div>
    <div class=card><h3>결제수단별</h3>
      ${db.methods.map(p=>{
        let v=t.filter(x=>x.method===p.n).reduce((s,x)=>s+x.amount,0);
        return `<button class='analysisRow' onclick='showAnalysisDetail("method",${JSON.stringify(p.n)})'>
          <span>${esc(p.n)}</span>
          <span>${won(v)} <b class=chev>›</b></span>
        </button>`
      }).join('')}
    </div>`;
  } else {
    a.innerHTML=`<h1>설정</h1>
    <div class=card><label>내 월 한도<input id=bme type=number inputmode=numeric value='${db.budgetMe}'></label><label>엄마카드 한도<input id=bmom type=number inputmode=numeric value='${db.budgetMom}'></label><button class=action onclick='budgets()'>한도 저장</button></div>
    <div class=card><h3>고정비 관리</h3>${db.fixed.slice().sort((a,b)=>a.day-b.day).map(f=>`<div class='row fixeditem'><span><b>${f.day}일 · ${esc(f.memo)}</b><br><span class=muted>${won(f.amount)} · ${esc(f.category)} · ${esc(f.method)}</span></span><button class=deletebtn onclick='deleteFixed(${JSON.stringify(f.id)})'>삭제</button></div>`).join('')||'<p class=muted>등록된 고정비가 없어요.</p>'}
    <div class=fixedform><input id=fday type=number min=1 max=31 inputmode=numeric placeholder='결제일 (예: 15)'><input id=famt type=number inputmode=numeric placeholder='금액'><select id=fcat>${db.categories.map(x=>`<option>${esc(x)}</option>`)}</select><select id=fmethod>${db.methods.map(x=>`<option>${esc(x.n)}</option>`)}</select><input class=wide id=fmemo placeholder='고정비 이름 (예: 보험료)'><button class='action wide' onclick='addFixed()'>고정비 추가</button></div><p class=hint>홈에서 실제 결제된 고정비를 체크하면 그 달 지출로 들어갑니다. 체크 전에는 예정 금액이라 지출 합계에 포함되지 않아요.</p></div>
    <div class=card><h3>카테고리 관리</h3><div class=catlist>${db.categories.map(x=>`<div class='row catrow'><span class=pill>${esc(x)}</span><button class='deletebtn' onclick='deleteCat(${JSON.stringify(x)})'>삭제</button></div>`).join('')}</div><div class='inline'><input id=newcat placeholder='새 카테고리'><button class=action onclick='addCat()'>추가</button></div><p class=hint>이미 사용한 카테고리를 삭제하면 해당 내역을 ‘기타’로 옮긴 뒤 삭제할 수 있어요.</p></div>
    <div class=card><h3>데이터</h3><button class=action onclick='csv()'>CSV 내보내기</button><button class=action onclick='downloadTemplate()'>CSV 입력 양식 받기</button><label class=filelabel>CSV 가져오기<input type=file id=csvImport accept='.csv,text/csv'></label><button class=action onclick='importCsv()'>선택한 CSV 가져오기</button><div id=importStatus class=hint></div><hr><button class=action onclick='backup()'>JSON 백업</button><input type=file id=restore accept='.json,application/json'><button class=action onclick='restoreJson()'>JSON 복원</button></div>`;
  }
}
function addDialog(){
  let d=document.createElement('dialog');
  d.innerHTML=`<h2>지출 추가</h2><input id=amt type=number inputmode=numeric placeholder='금액'><input id=date type=date value='${new Date().toISOString().slice(0,10)}'><select id=cat>${db.categories.map(x=>`<option>${esc(x)}</option>`)}</select><select id=method>${db.methods.map(x=>`<option>${esc(x.n)}</option>`)}</select><input id=memo placeholder='내용'><button class=action id=saveTx>저장</button><button class=action id=cancel>취소</button>`;
  document.body.append(d);d.showModal();
  d.querySelector('#saveTx').onclick=()=>{let amount=+d.querySelector('#amt').value;if(!amount)return;db.tx.push({id:crypto.randomUUID(),amount,date:d.querySelector('#date').value,category:d.querySelector('#cat').value,method:d.querySelector('#method').value,memo:d.querySelector('#memo').value});save();d.close();d.remove();render()};
  d.querySelector('#cancel').onclick=()=>{d.close();d.remove()};
}
window.delTx=id=>{if(!confirm('이 지출 내역을 삭제할까요?'))return;db.tx=db.tx.filter(x=>x.id!==id);save();render()};

window.editTx=id=>{
  const x=db.tx.find(t=>t.id===id);
  if(!x)return;

  const d=document.createElement('dialog');
  d.className='editDialog';
  d.innerHTML=`
    <h2>지출 수정</h2>
    <label>금액<input id=eamt type=number inputmode=numeric value='${Number(x.amount||0)}'></label>
    <label>날짜<input id=edate type=date value='${esc(x.date)}'></label>
    <label>카테고리<select id=ecat>${db.categories.map(c=>`<option ${c===x.category?'selected':''}>${esc(c)}</option>`)}</select></label>
    <label>결제수단<select id=emethod>${db.methods.map(p=>`<option ${p.n===x.method?'selected':''}>${esc(p.n)}</option>`)}</select></label>
    <label>내용<input id=ememo value='${esc(x.memo||'')}'></label>
    <div class='editActions'>
      <button class=action id=updateTx>저장</button>
      <button class='action dangerBtn' id=deleteTx>삭제</button>
      <button class=action id=cancelEdit>취소</button>
    </div>`;
  document.body.append(d);
  d.showModal();

  d.querySelector('#updateTx').onclick=()=>{
    const amount=+d.querySelector('#eamt').value;
    if(!amount){alert('금액을 입력해주세요.');return;}
    x.amount=amount;
    x.date=d.querySelector('#edate').value;
    x.category=d.querySelector('#ecat').value;
    x.method=d.querySelector('#emethod').value;
    x.memo=d.querySelector('#ememo').value.trim();
    save(); d.close(); d.remove(); render();
  };
  d.querySelector('#deleteTx').onclick=()=>{
    if(!confirm('이 지출 내역을 삭제할까요?'))return;
    db.tx=db.tx.filter(t=>t.id!==id);
    save(); d.close(); d.remove(); render();
  };
  d.querySelector('#cancelEdit').onclick=()=>{d.close();d.remove()};
};

window.budgets=()=>{db.budgetMe=+bme.value;db.budgetMom=+bmom.value;save();render()};
window.addCat=()=>{let v=newcat.value.trim();if(v&&!db.categories.includes(v)){db.categories.push(v);save();render()}};
window.deleteCat=name=>{const used=db.tx.filter(x=>x.category===name).length;if(used===0){if(confirm(`‘${name}’ 카테고리를 삭제할까요?`)){db.categories=db.categories.filter(x=>x!==name);save();render()}return;}if(name==='기타'){alert('‘기타’ 카테고리에 기존 지출이 있어서 지금은 삭제할 수 없어요.');return;}if(confirm(`‘${name}’ 사용 내역 ${used}건을 ‘기타’로 바꾸고 삭제할까요?`)){if(!db.categories.includes('기타'))db.categories.push('기타');db.tx.forEach(x=>{if(x.category===name)x.category='기타'});db.categories=db.categories.filter(x=>x!==name);save();render()}};
window.addFixed=()=>{let day=+fday.value,amount=+famt.value,memo=fmemo.value.trim();if(day<1||day>31||amount<=0||!memo){alert('결제일, 금액, 이름을 확인해주세요.');return;}db.fixed.push({id:crypto.randomUUID(),day,amount,category:fcat.value,method:fmethod.value,memo});save();render()};
window.deleteFixed=id=>{if(!confirm('이 고정비를 삭제할까요?'))return;db.fixed=db.fixed.filter(x=>x.id!==id);save();render()};
window.toggleFixed=(id,checked)=>{
  const f=db.fixed.find(x=>x.id===id);
  if(!f)return;
  const txid=fixedTxId(f);

  if(checked){
    if(db.tx.some(x=>x.id===txid)){render();return;}

    const input=prompt(
      `${f.memo}\n이번 달 실제 결제금액을 입력해주세요.\n(예상금액 ${won(f.amount)})`,
      String(f.amount)
    );

    if(input===null){render();return;}

    const actual=Number(String(input).replace(/[원,\s]/g,''));
    if(!Number.isFinite(actual)||actual<=0){
      alert('금액을 확인해주세요.');
      render();
      return;
    }

    db.tx.push({
      id:txid,
      date:fixedDate(f),
      amount:actual,
      category:f.category,
      method:f.method,
      memo:f.memo,
      fixedId:f.id,
      plannedAmount:Number(f.amount||0)
    });
  }else{
    db.tx=db.tx.filter(x=>x.id!==txid);
  }

  save();
  render();
};
window.moveMonth=n=>{let [y,m]=calMonth.split('-').map(Number);let d=new Date(y,m-1+n,1);calMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;render()};
window.toggleCalendarMom=()=>{calExcludeMom=!calExcludeMom;render()};
window.showDay=date=>{let items=db.tx.filter(x=>x.date===date).filter(x=>{if(!calExcludeMom)return true;const p=db.methods.find(p=>p.n===x.method);return p?.owner!=='mom'});let d=document.createElement('dialog');d.innerHTML=`<h2>${date}</h2>${items.map(x=>`<div class='row listitem'><span>${esc(x.memo||x.category)}<br><span class=muted>${esc(x.method)} · ${esc(x.category)}</span></span><b>${won(x.amount)}</b></div>`).join('')||'<p class=muted>지출 없음</p>'}<p><b>합계 ${won(items.reduce((s,x)=>s+x.amount,0))}</b></p><button class=action>닫기</button>`;document.body.append(d);d.showModal();d.querySelector('button').onclick=()=>{d.close();d.remove()}};

window.showAnalysisDetail=(type,value)=>{
  const t=monthTx().filter(x=>type==='category' ? x.category===value : x.method===value)
                   .sort((a,b)=>b.date.localeCompare(a.date));
  const total=t.reduce((s,x)=>s+Number(x.amount||0),0);
  const title=type==='category' ? `${value} 세부내역` : `${value} 세부내역`;
  const d=document.createElement('dialog');
  d.className='detailDialog';
  d.innerHTML=`
    <div class='detailHead'>
      <div>
        <h2>${esc(title)}</h2>
        <p class='muted'>이번 달 ${t.length}건 · 총 ${won(total)}</p>
      </div>
      <button class='dialogClose' aria-label='닫기'>×</button>
    </div>
    <div class='detailList'>
      ${t.map(x=>`
        <div class='detailItem'>
          <div>
            <b>${esc(x.memo||x.category)}</b>
            <div class='muted detailMeta'>${esc(x.date)} · ${esc(type==='category'?x.method:x.category)}</div>
          </div>
          <strong>${won(x.amount)}</strong>
        </div>`).join('')||'<p class=muted>해당 내역이 없어요.</p>'}
    </div>
    <div class='detailTotal'><span>합계</span><b>${won(total)}</b></div>`;
  document.body.append(d);
  d.showModal();
  d.querySelector('.dialogClose').onclick=()=>{d.close();d.remove()};
  d.addEventListener('click',e=>{if(e.target===d){d.close();d.remove()}});
};

function download(name,text,type){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},100)}
window.backup=()=>{
  db.lastBackupAt=new Date().toISOString();
  save();
  download('지현이의_가계부_backup.json',JSON.stringify(db,null,2),'application/json');
  render();
};
window.csv=()=>{let rows=[['날짜','금액','카테고리','결제수단','내용'],...db.tx.map(x=>[x.date,x.amount,x.category,x.method,x.memo])];download('가계부.csv','\ufeff'+toCSV(rows),'text/csv;charset=utf-8')};
window.downloadTemplate=()=>{let rows=[['날짜','금액','카테고리','결제수단','내용'],['2026-08-12','12500','식비','내 신용카드','점심']];download('가계부_입력양식.csv','\ufeff'+toCSV(rows),'text/csv;charset=utf-8')};
function toCSV(rows){return rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')}
function parseCSV(text){text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else{if(c==='"')quoted=true;else if(c===','){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field=''}else field+=c}}if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row)}return rows.filter(r=>r.some(v=>String(v).trim()!==''))}
function normalizeDate(v){v=String(v||'').trim();let m=v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);if(!m)return null;return `${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`}
window.importCsv=()=>{const f=document.querySelector('#csvImport')?.files?.[0];if(!f){alert('가져올 CSV 파일을 먼저 선택해주세요.');return;}const r=new FileReader();r.onload=()=>{try{const rows=parseCSV(r.result);if(rows.length<2)throw new Error('데이터가 없어요.');const headers=rows[0].map(x=>String(x).trim());const aliases={date:['날짜','일자','사용일자'],amount:['금액','사용금액','승인금액'],category:['카테고리','분류'],method:['결제수단','지불수단','결제방법'],memo:['내용','메모','상세내용','가맹점']};const idx={};for(const [k,names] of Object.entries(aliases))idx[k]=headers.findIndex(h=>names.includes(h));if(idx.date<0||idx.amount<0||idx.category<0||idx.method<0)throw new Error('첫 줄에 날짜, 금액, 카테고리, 결제수단 열이 필요해요.');let added=0,skipped=0;for(const row of rows.slice(1)){const date=normalizeDate(row[idx.date]);const amount=Number(String(row[idx.amount]||'').replace(/[원,\s]/g,''));const category=String(row[idx.category]||'').trim()||'기타';const method=String(row[idx.method]||'').trim();const memo=idx.memo>=0?String(row[idx.memo]||'').trim():'';if(!date||!Number.isFinite(amount)||amount<=0||!db.methods.some(p=>p.n===method)){skipped++;continue;}if(!db.categories.includes(category))db.categories.push(category);db.tx.push({id:crypto.randomUUID(),date,amount,category,method,memo});added++;}save();render();alert(`${added}건을 가져왔어요.${skipped?`\n${skipped}건은 건너뛰었어요.`:''}`)}catch(e){alert('CSV를 가져오지 못했어요. '+e.message)}};r.readAsText(f,'utf-8')};
window.restoreJson=()=>{let f=restore.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{const obj=JSON.parse(r.result);if(!obj||!Array.isArray(obj.tx)||!Array.isArray(obj.categories))throw new Error();db=obj;db.fixed ||= [];if(!db.methods.some(x=>x.n==='체크카드'))db.methods.push({n:'체크카드',owner:'me'});save();render();alert('백업을 복원했어요.')}catch(e){alert('백업 파일을 읽을 수 없어요.')}};r.readAsText(f)};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
document.querySelector('#add').onclick=addDialog; save(); render();
