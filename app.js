const KEY='jihyeonBudgetV1';
const seed={budgetMe:1000000,budgetMom:1000000,categories:['식비','카페','쇼핑','생활','교통','의료','미용','문화·여가','구독','보험','기타'],methods:[{n:'내 신용카드',owner:'me'},{n:'엄마카드',owner:'mom'},{n:'계좌이체',owner:'me'},{n:'체크카드',owner:'me'}],tx:[],fixed:[]};
let db=JSON.parse(localStorage.getItem(KEY)||'null')||structuredClone(seed), tab='home', selectedMonth=currentMonth(), calExcludeMom=false, analysisExcludeMom=false, historyMethodFilter='', historyCategoryFilter='';
db.categories ||= seed.categories; db.methods ||= seed.methods; db.tx ||= []; db.fixed ||= [];
if(!db.methods.some(x=>x.n==='체크카드')) db.methods.push({n:'체크카드',owner:'me'});
const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const won=n=>Number(n||0).toLocaleString('ko-KR')+'원';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function localYmd(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function currentMonth(){return localYmd().slice(0,7)}
function monthTx(m=selectedMonth){return db.tx.filter(x=>x.date.startsWith(m))}
function sums(m=selectedMonth){let t=monthTx(m), me=0,mom=0;t.forEach(x=>{let p=db.methods.find(p=>p.n===x.method);(p?.owner==='mom'?mom+=x.amount:me+=x.amount)});return{me,mom,t}}
function fixedTxId(f,m=selectedMonth){return `fixed:${f.id}:${m}`}
function fixedDate(f,m=selectedMonth){let [y,mo]=m.split('-').map(Number);let last=new Date(y,mo,0).getDate();return `${m}-${String(Math.min(+f.day,last)).padStart(2,'0')}`}
function monthLabel(m=selectedMonth){const [y,mo]=m.split('-').map(Number);return `${y}년 ${mo}월`}
function monthNavHtml(extraClass=''){return `<div class="monthNav ${extraClass}"><button class="monthNavArrow" onclick="moveMonth(-1)" aria-label="이전 달">‹</button><button class="monthNavTitle" onclick="chooseMonth()">${monthLabel()}</button><button class="monthNavArrow" onclick="moveMonth(1)" aria-label="다음 달">›</button></div>`}
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
  const [y,m]=selectedMonth.split('-').map(Number);
  const lastDay=new Date(y,m,0).getDate();

  const allTx=monthTx(selectedMonth);
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
  const today=localYmd();

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
      const ds=`${selectedMonth}-${String(d).padStart(2,'0')}`;
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
          <button class="calendarMonthPick" onclick='chooseMonth()'>${y}년 ${m}월</button>
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

function previousMonth(m=selectedMonth){
  const [y,mo]=m.split('-').map(Number);
  const d=new Date(y,mo-2,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function monthInsight(){
  const cur=monthTx(selectedMonth);
  const prev=monthTx(previousMonth(selectedMonth));
  const curTotal=cur.reduce((s,x)=>s+Number(x.amount||0),0);
  const prevTotal=prev.reduce((s,x)=>s+Number(x.amount||0),0);
  const by={}; cur.forEach(x=>by[x.category]=(by[x.category]||0)+Number(x.amount||0));
  const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
  let line='아직 이번 달 지출이 없어요.';
  if(curTotal && prevTotal){
    const diff=curTotal-prevTotal;
    if(diff===0) line='지난달과 지출 금액이 같아요.';
    else line=`지난달보다 ${won(Math.abs(diff))} ${diff<0?'덜':'더'} 썼어요${diff<0?' 🎉':''}`;
  }else if(curTotal && !prevTotal){
    line=`이번 달 현재까지 ${won(curTotal)}을 사용했어요.`;
  }
  if(top) line+=` 가장 큰 비중은 ${top[0]} ${won(top[1])}이에요.`;
  return line;
}
function homeCard(title,amount,budget,type,extra=''){
  const pct=budget>0?Math.min(100,amount/budget*100):0;
  return `<div class='card clickableCard' onclick='showHomeDetail(${JSON.stringify(type)})'>
    <div class='cardTopLine'><div class=muted>${esc(title)}</div><span class=cardChevron>›</span></div>
    <div class=big>${won(amount)} <span class=muted>/ ${won(budget)}</span></div>
    <div class=bar><i style='width:${pct}%'></i></div>${extra}</div>`;
}
function render(){
  let a=document.querySelector('#app');
  if(tab==='home'){
    let s=sums();
    const total=s.me+s.mom, totalBudget=Number(db.budgetMe||0)+Number(db.budgetMom||0);
    const pct=totalBudget?Math.min(100,total/totalBudget*100):0;
    const fixedPlanned=db.fixed.reduce((sum,f)=>sum+Number(f.amount||0),0);
    const fixedPaid=db.fixed.reduce((sum,f)=>{const tx=db.tx.find(x=>x.id===fixedTxId(f));return sum+(tx?Number(tx.amount||0):0)},0);
    a.innerHTML=`<h1>지현이의 가계부🤑</h1>${monthNavHtml('homeMonthNav')}${backupStatusHtml()}
    <div class='monthOverview clickableCard' onclick='showHomeDetail("all")'>
      <div class='cardTopLine'><div class=muted>${monthLabel()} 전체 지출</div><span class=cardChevron>›</span></div>
      <div class='overviewAmount'>${won(total)}</div>
      <div class=bar><i style='width:${pct}%'></i></div>
      <div class=progressMeta><span>월 예산 ${won(totalBudget)}</span><span>${Math.round(pct)}% 사용</span></div>
    </div>
    <div class='monthComment'><b>💸 이번 달 한마디</b>${esc(monthInsight())}</div>
    ${homeCard('내 지출',s.me,db.budgetMe,'me',`<p>남은 금액 ${won(Math.max(0,db.budgetMe-s.me))}</p>`)}
    ${homeCard('엄마카드',s.mom,db.budgetMom,'mom',`<p>${s.mom>db.budgetMom?'<span class=danger>한도 초과 '+won(s.mom-db.budgetMom)+'</span>':'남은 한도 '+won(db.budgetMom-s.mom)}</p>`)}
    <div class=card>
      <div class='fixedSummaryHead'>
        <div><h3>${monthLabel()} 고정비</h3><div class='muted'>등록된 총 고정비</div></div>
        <div><div class='fixedSummaryAmount'>${won(fixedPlanned)}</div><button class='smallbtn' onclick='showHomeDetail("fixed")'>내역 보기 ›</button></div>
      </div>
      <div class='fixedPaidSummary'><span>지출 처리됨</span><b>${won(fixedPaid)}</b></div>
      ${renderFixedHome()}
    </div>
    <div class=card><h3>최근 지출</h3>${s.t.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(x=>`<div class='row listitem'><span>${esc(x.memo||x.category)}<br><span class=muted>${esc(x.method)}</span></span><b>${won(x.amount)}</b></div>`).join('')||'<p class=muted>아직 기록이 없어요.</p>'}</div>`;
  } else if(tab==='history'){
    let t=monthTx(selectedMonth).slice().sort((a,b)=>b.date.localeCompare(a.date));
    if(historyMethodFilter)t=t.filter(x=>x.method===historyMethodFilter);
    if(historyCategoryFilter)t=t.filter(x=>x.category===historyCategoryFilter);
    a.innerHTML=`<h1>내역</h1>${monthNavHtml('historyMonthNav')}
      <div class='historyFilters'>
        <select onchange='setHistoryMethod(this.value)'><option value=''>전체 결제수단</option>${db.methods.map(p=>`<option value='${esc(p.n)}' ${historyMethodFilter===p.n?'selected':''}>${esc(p.n)}</option>`).join('')}</select>
        <select onchange='setHistoryCategory(this.value)'><option value=''>전체 카테고리</option>${db.categories.map(c=>`<option value='${esc(c)}' ${historyCategoryFilter===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
      </div>
      <div class='filterCaption'><span>${monthLabel()}</span><span>${t.length}건 · ${won(t.reduce((s,x)=>s+Number(x.amount||0),0))}</span></div>
      <div class=card>${t.map(x=>`<div class='row listitem historyItem' onclick='editTx("${x.id}")'><span>${esc(x.date)} · ${esc(x.category)}<br><span class=muted>${esc(x.method)} · ${esc(x.memo||'')}</span></span><span class='historyRight'><b>${won(x.amount)}</b><span class=editHint>수정 ›</span></span></div>`).join('')||`<p class=muted>조건에 맞는 ${monthLabel()} 기록이 없어요.</p>`}</div>`;
  } else if(tab==='calendar'){
    a.innerHTML=renderCalendar();
  } else if(tab==='analysis'){
    let t=monthTx(selectedMonth);
    if(analysisExcludeMom)t=t.filter(x=>db.methods.find(p=>p.n===x.method)?.owner!=='mom');
    let by={}; t.forEach(x=>by[x.category]=(by[x.category]||0)+Number(x.amount||0));
    let total=t.reduce((s,x)=>s+Number(x.amount||0),0);
    a.innerHTML=`<h1>분석</h1>${monthNavHtml('analysisMonthNav')}
    <div class='analysisFilterBar'>
      <button class='${analysisExcludeMom?'active':''}' onclick='toggleAnalysisMom()'>${analysisExcludeMom?'✓ 엄마카드 제외 중':'엄마카드 제외해서 보기'}</button>
      <span>${analysisExcludeMom?'내 지출만 분석 중':'엄마카드 포함'}</span>
    </div>
    <div class=card><div class='analysisTotal'><span>${monthLabel()} 총 분석 금액</span><b>${won(total)}</b></div><h3>카테고리별</h3>
      ${Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
        <button class='analysisRow' onclick='showAnalysisDetail("category",${JSON.stringify(k)})'>
          <span>${esc(k)}</span><span>${won(v)} · ${total?Math.round(v/total*100):0}% <b class=chev>›</b></span>
        </button>`).join('')||`<p class=muted>${monthLabel()} 기록 없음</p>`}
    </div>
    <div class=card><h3>결제수단별</h3>
      ${db.methods.filter(p=>!(analysisExcludeMom&&p.owner==='mom')).map(p=>{let v=t.filter(x=>x.method===p.n).reduce((s,x)=>s+Number(x.amount||0),0);return `<button class='analysisRow' onclick='showAnalysisDetail("method",${JSON.stringify(p.n)})'><span>${esc(p.n)}</span><span>${won(v)} <b class=chev>›</b></span></button>`}).join('')}
    </div>`;
  } else {
    a.innerHTML=`<h1>설정</h1>
    <div class=card><h3>월 예산</h3><label>내 월 한도<input id=bme type=number inputmode=numeric value='${db.budgetMe}'></label><label>엄마카드 한도<input id=bmom type=number inputmode=numeric value='${db.budgetMom}'></label><button class=action onclick='budgets()'>한도 저장</button></div>
    <div class=card><h3>고정비 관리</h3>${db.fixed.slice().sort((a,b)=>a.day-b.day).map(f=>`<div class='row fixeditem'><span><b>${f.day}일 · ${esc(f.memo)}</b><br><span class=muted>${won(f.amount)} · ${esc(f.category)} · ${esc(f.method)}</span></span><button class=deletebtn onclick='deleteFixed(${JSON.stringify(f.id)})'>삭제</button></div>`).join('')||'<p class=muted>등록된 고정비가 없어요.</p>'}
    <div class=fixedform><input id=fday type=number min=1 max=31 inputmode=numeric placeholder='결제일 (예: 15)'><input id=famt type=number inputmode=numeric placeholder='금액'><select id=fcat>${db.categories.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id=fmethod>${db.methods.map(x=>`<option>${esc(x.n)}</option>`).join('')}</select><input class=wide id=fmemo placeholder='고정비 이름 (예: 보험료)'><button class='action wide' onclick='addFixed()'>고정비 추가</button></div><p class=hint>홈에서 실제 결제된 고정비를 체크하면 그 달 지출로 들어갑니다. 체크 전에는 예정 금액이라 지출 합계에 포함되지 않아요.</p></div>
    <div class=card><h3>카테고리 관리</h3><div class=catlist>${db.categories.map(x=>`<div class='row catrow'><span class=pill>${esc(x)}</span><button class='deletebtn' onclick='deleteCat(${JSON.stringify(x)})'>삭제</button></div>`).join('')}</div><div class='inline'><input id=newcat placeholder='새 카테고리'><button class=action onclick='addCat()'>추가</button></div><p class=hint>이미 사용한 카테고리를 삭제하면 해당 내역을 ‘기타’로 옮긴 뒤 삭제할 수 있어요.</p></div>
    <div class=card><h3>데이터 관리</h3><div class='settingsDataList'>
      <div class='settingsDataCard'><div><strong>CSV 내보내기</strong><span>전체 지출 내역을 CSV로 저장해요.</span></div><button class='action' onclick='csv()'>내보내기</button></div>
      <div class='settingsDataCard'><div><strong>CSV 가져오기</strong><span>양식에 맞춘 지출 내역을 추가해요.</span></div><label class='compactFile'>파일 선택<input type=file id=csvImport accept='.csv,text/csv'></label></div>
      <div class='settingsDataCard'><div><strong>선택한 CSV 적용</strong><span>선택한 파일의 내역을 현재 데이터에 추가해요.</span></div><button class='action' onclick='importCsv()'>가져오기</button></div>
      <div class='settingsDataCard'><div><strong>CSV 입력 양식</strong><span>가져오기용 기본 양식을 받아요.</span></div><button class='action' onclick='downloadTemplate()'>양식 받기</button></div>
      <div class='settingsDataCard'><div><strong>전체 JSON 백업</strong><span>설정·고정비·모든 지출을 한 번에 보관해요.</span></div><button class='action' onclick='backup()'>백업</button></div>
      <div class='settingsDataCard'><div><strong>JSON 복원</strong><span>이전에 저장한 전체 백업으로 되돌려요.</span></div><label class='compactFile'>파일 선택<input type=file id=restore accept='.json,application/json'></label></div>
      <div class='settingsDataCard'><div><strong>선택한 백업 복원</strong><span>현재 데이터가 백업 내용으로 교체됩니다.</span></div><button class='action' onclick='restoreJson()'>복원</button></div>
    </div></div>`;
  }
}
window.setHistoryMethod=v=>{historyMethodFilter=v;render()};
window.setHistoryCategory=v=>{historyCategoryFilter=v;render()};
window.showHomeDetail=type=>{
  let t=monthTx(selectedMonth).slice();
  let title=`${monthLabel()} 전체 지출`;
  if(type==='me'){t=t.filter(x=>db.methods.find(p=>p.n===x.method)?.owner!=='mom'); title='내 지출';}
  if(type==='mom'){t=t.filter(x=>db.methods.find(p=>p.n===x.method)?.owner==='mom'); title='엄마카드';}
  if(type==='fixed'){t=t.filter(x=>x.fixedId); title='고정비 지출';}
  t.sort((a,b)=>b.date.localeCompare(a.date));
  const total=t.reduce((s,x)=>s+Number(x.amount||0),0);
  const d=document.createElement('dialog');d.className='homeDetailDialog';
  d.innerHTML=`<div class='homeDetailHead'><h2>${esc(title)}</h2><div class=muted>${monthLabel()} · ${t.length}건</div></div><div class='homeDetailBody'>${t.map(x=>`<div class='row listitem'><span>${esc(x.memo||x.category)}<br><span class=muted>${esc(x.date)} · ${esc(x.method)} · ${esc(x.category)}</span></span><b>${won(x.amount)}</b></div>`).join('')||'<p class=muted>해당 내역이 없어요.</p>'}</div><div class='homeDetailFoot'><span>합계</span><b>${won(total)}</b></div><button class=action id=closeHomeDetail>닫기</button>`;
  document.body.append(d);d.showModal();d.querySelector('#closeHomeDetail').onclick=()=>{d.close();d.remove()};d.addEventListener('click',e=>{if(e.target===d){d.close();d.remove()}});
};
function addDialog(){
  let d=document.createElement('dialog');
  d.innerHTML=`<h2>지출 추가</h2><input id=amt type=number inputmode=numeric placeholder='금액'><input id=date type=date value='${localYmd()}'><select id=cat>${db.categories.map(x=>`<option>${esc(x)}</option>`)}</select><select id=method>${db.methods.map(x=>`<option>${esc(x.n)}</option>`)}</select><input id=memo placeholder='내용'><button class=action id=saveTx>저장</button><button class=action id=cancel>취소</button>`;
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
      `${f.memo}\n${monthLabel()} 실제 결제금액을 입력해주세요.\n(예상금액 ${won(f.amount)})`,
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
window.moveMonth=n=>{let [y,m]=selectedMonth.split('-').map(Number);let d=new Date(y,m-1+n,1);selectedMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;render()};
window.chooseMonth=()=>{const d=document.createElement('dialog');d.className='monthPickerDialog';d.innerHTML=`<h2>연·월 선택</h2><input id=monthPick type=month value='${selectedMonth}'><div class='monthPickerActions'><button class=action id=applyMonth>선택</button><button class=action id=cancelMonth>취소</button></div>`;document.body.append(d);d.showModal();d.querySelector('#applyMonth').onclick=()=>{const v=d.querySelector('#monthPick').value;if(v)selectedMonth=v;d.close();d.remove();render()};d.querySelector('#cancelMonth').onclick=()=>{d.close();d.remove()};};
window.toggleCalendarMom=()=>{calExcludeMom=!calExcludeMom;render()};
window.toggleAnalysisMom=()=>{analysisExcludeMom=!analysisExcludeMom;render()};
window.showDay=date=>{let items=db.tx.filter(x=>x.date===date).filter(x=>{if(!calExcludeMom)return true;const p=db.methods.find(p=>p.n===x.method);return p?.owner!=='mom'});let d=document.createElement('dialog');d.innerHTML=`<h2>${date}</h2>${items.map(x=>`<div class='row listitem'><span>${esc(x.memo||x.category)}<br><span class=muted>${esc(x.method)} · ${esc(x.category)}</span></span><b>${won(x.amount)}</b></div>`).join('')||'<p class=muted>지출 없음</p>'}<p><b>합계 ${won(items.reduce((s,x)=>s+x.amount,0))}</b></p><button class=action>닫기</button>`;document.body.append(d);d.showModal();d.querySelector('button').onclick=()=>{d.close();d.remove()}};

window.showAnalysisDetail=(type,value)=>{
  let t=monthTx(selectedMonth);
  if(analysisExcludeMom)t=t.filter(x=>db.methods.find(p=>p.n===x.method)?.owner!=='mom');
  t=t.filter(x=>type==='category' ? x.category===value : x.method===value)
                   .sort((a,b)=>b.date.localeCompare(a.date));
  const total=t.reduce((s,x)=>s+Number(x.amount||0),0);
  const title=type==='category' ? `${value} 세부내역` : `${value} 세부내역`;
  const d=document.createElement('dialog');
  d.className='detailDialog';
  d.innerHTML=`
    <div class='detailHead'>
      <div>
        <h2>${esc(title)}</h2>
        <p class='muted'>${monthLabel()} ${t.length}건 · 총 ${won(total)}</p>
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
