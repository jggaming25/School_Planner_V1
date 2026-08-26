let testsData = [];
let currentTest = null;

async function loadTests() {
  if (!currentProfile?.school_id) return;
  testsData = await dbGet('tests', { school_id: currentProfile.school_id });
}

function renderTests() {
  loadTests().then(() => {
    const el = document.getElementById('tests-list');
    if (!el) return;
    const myTests = testsData.filter(t => t.teacher_id === currentUser.id);
    const mySubmissions = testsData.filter(t => currentProfile.role === 'student');
    if (currentProfile.role === 'teacher' || ['school_admin','admin','supporter','head_admin','super_admin','ceo'].includes(currentProfile.role)) {
      renderTeacherTests(el, myTests);
    } else {
      renderStudentTests(el);
    }
  });
}

function renderTeacherTests(el, myTests) {
  if (myTests.length === 0) {
    el.innerHTML = '<div class="empty-state"><h3>Keine Tests</h3><p>Erstelle deinen ersten Test</p></div>';
    return;
  }
  el.innerHTML = '<div class="grid grid-2">' + myTests.map(t => {
    const submissions = t._submissions || [];
    return `<div class="card">
      <div class="flex-between mb-8">
        <h3 style="font-size:1rem">${escapeHtml(t.title)}</h3>
        <span class="badge ${t.is_active ? 'badge-green' : 'badge-yellow'}">${t.is_active ? 'Aktiv' : 'Inaktiv'}</span>
      </div>
      <div style="font-size:0.813rem;color:var(--text-secondary);margin-bottom:12px">
        Code: <strong style="letter-spacing:1px">${escapeHtml(t.access_code)}</strong>
        ${t.is_unlimited ? ' &middot; Kein Zeitlimit' : t.time_limit_minutes ? ` &middot; ${t.time_limit_minutes} Min.` : ''}
      </div>
      <div class="flex gap-8 mb-12">
        <button class="btn btn-sm ${t.is_active ? 'btn-secondary' : 'btn-primary'}" onclick="toggleTestActive('${t.id}', ${!t.is_active})">
          ${t.is_active ? 'Stoppen' : 'Starten'}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="editTest('${t.id}')">Bearbeiten</button>
        <button class="btn btn-ghost btn-sm" onclick="viewTestResults('${t.id}')">Ergebnisse</button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteTest('${t.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted)">
        Erstellt: ${formatDate(t.created_at)} ${t.max_points ? '&middot; ' + t.max_points + ' Punkte' : ''}
      </div>
    </div>`;
  }).join('') + '</div>';
}

async function renderStudentTests(el) {
  const subs = await dbGet('test_submissions', { student_id: currentUser.id });
  const submittedTestIds = subs.map(s => s.test_id);
  const activeTests = testsData.filter(t => t.is_active && t.school_id === currentProfile.school_id);
  const myHistory = testsData.filter(t => submittedTestIds.includes(t.id));

  let html = '<h3 class="mb-12">Aktive Tests</h3>';
  if (activeTests.length === 0) {
    html += '<div class="text-muted mb-24" style="font-size:0.875rem">Keine aktiven Tests</div>';
  } else {
    html += '<div class="grid grid-2 mb-24">' + activeTests.map(t => {
      const sub = subs.find(s => s.test_id === t.id);
      return `<div class="card">
        <h3 style="font-size:1rem;margin-bottom:8px">${escapeHtml(t.title)}</h3>
        ${sub ? `<span class="badge badge-green">Abgegeben</span>` :
        `<button class="btn btn-primary btn-sm" onclick="startTest('${t.id}')">Test starten</button>`}
      </div>`;
    }).join('') + '</div>';
  }
  html += '<h3 class="mb-12">Meine Ergebnisse</h3>';
  if (myHistory.length === 0) {
    html += '<div class="text-muted" style="font-size:0.875rem">Noch keine Ergebnisse</div>';
  } else {
    html += '<div class="grid grid-2">' + myHistory.map(t => {
      const sub = subs.find(s => s.test_id === t.id);
      return `<div class="card">
        <h3 style="font-size:1rem;margin-bottom:4px">${escapeHtml(t.title)}</h3>
        <div style="font-size:0.813rem;color:var(--text-secondary)">
          ${sub?.total_points || 0} / ${t.max_points || '?'} Punkte
          ${sub?.grade ? ' &middot; ' + sub.grade : ''}
        </div>
        ${sub?.visible_to_student && sub?.feedback ? `<div style="margin-top:8px;font-size:0.813rem;background:var(--bg-tertiary);padding:8px;border-radius:var(--radius-sm)">${escapeHtml(sub.feedback)}</div>` : ''}
      </div>`;
    }).join('') + '</div>';
  }
  el.innerHTML = html;
}

function openCreateTestModal() {
  const classSelect = document.getElementById('test-class');
  const subjectSelect = document.getElementById('test-subject');
  classSelect.innerHTML = '<option value="">Klasse wählen</option>' + schoolClasses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  subjectSelect.innerHTML = '<option value="">Fach wählen</option>' + subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('test-questions-container').innerHTML = '';
  openModal('create-test-modal');
}

function addTestQuestion() {
  const container = document.getElementById('test-questions-container');
  const idx = container.children.length;
  const qHtml = `
    <div class="card mb-12 question-card" data-index="${idx}" style="padding:16px">
      <div class="flex-between mb-8">
        <strong>Frage ${idx + 1}</strong>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="this.closest('.question-card').remove()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="input-group"><label>Fragetext</label><textarea class="input-field q-text" rows="2" placeholder="Frage..."></textarea></div>
      <div class="grid grid-2">
        <div class="input-group"><label>Typ</label>
          <select class="input-field q-type" onchange="toggleQuestionOptions(this)">
            <option value="mc">Multiple Choice</option>
            <option value="text">Freitext</option>
            <option value="number">Zahl</option>
            <option value="true_false">Richtig/Falsch</option>
          </select>
        </div>
        <div class="input-group"><label>Punkte</label><input type="number" class="input-field q-points" value="1" min="1"></div>
      </div>
      <div class="q-options-group">
        <div class="input-group"><label>Antwortoptionen (je Zeile eine)</label>
          <textarea class="input-field q-options" rows="3" placeholder="Antwort A&#10;Antwort B&#10;Antwort C&#10;Antwort D"></textarea>
        </div>
        <div class="input-group"><label>Richtige Antwort(en) (Nummer, z.B. 1 oder 1,3)</label>
          <input type="text" class="input-field q-correct" placeholder="1">
        </div>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', qHtml);
}

function toggleQuestionOptions(select) {
  const card = select.closest('.question-card');
  const optionsGroup = card.querySelector('.q-options-group');
  const type = select.value;
  if (type === 'text') {
    optionsGroup.innerHTML = '<div class="input-group"><label>Musterantwort (optional)</label><textarea class="input-field q-correct" rows="2" placeholder="Erwartete Antwort..."></textarea></div>';
  } else if (type === 'number') {
    optionsGroup.innerHTML = '<div class="input-group"><label>Richtige Zahl</label><input type="number" class="input-field q-correct" step="any"></div>';
  } else if (type === 'true_false') {
    optionsGroup.innerHTML = '<div class="input-group"><label>Richtige Antwort</label><select class="input-field q-correct"><option value="true">Richtig</option><option value="false">Falsch</option></select></div>';
  } else {
    optionsGroup.innerHTML = `
      <div class="input-group"><label>Antwortoptionen (je Zeile eine)</label>
        <textarea class="input-field q-options" rows="3" placeholder="Antwort A&#10;Antwort B&#10;Antwort C&#10;Antwort D"></textarea>
      </div>
      <div class="input-group"><label>Richtige Antwort(en) (Nummer, z.B. 1 oder 1,3)</label>
        <input type="text" class="input-field q-correct" placeholder="1">
      </div>`;
  }
}

async function saveTest() {
  const title = document.getElementById('test-title').value;
  if (!title) { showToast('Titel nötig', 'error'); return; }
  const code = generateAccessCode();
  const isUnlimited = document.getElementById('test-unlimited').checked;
  const questionCards = document.querySelectorAll('.question-card');
  let maxPoints = 0;
  const questions = [];
  questionCards.forEach(card => {
    const text = card.querySelector('.q-text').value;
    const type = card.querySelector('.q-type').value;
    const points = parseInt(card.querySelector('.q-points').value) || 1;
    const options = card.querySelector('.q-options')?.value?.split('\n').filter(Boolean) || null;
    const correct = card.querySelector('.q-correct')?.value || null;
    maxPoints += points;
    questions.push({ question_text: text, question_type: type, options, correct_answer: correct, points });
  });
  const test = await dbInsert('tests', {
    school_id: currentProfile.school_id,
    teacher_id: currentUser.id,
    class_id: document.getElementById('test-class').value || null,
    subject_id: document.getElementById('test-subject').value || null,
    title,
    description: document.getElementById('test-description').value,
    access_code: code,
    time_limit_minutes: isUnlimited ? null : parseInt(document.getElementById('test-time').value) || null,
    is_unlimited: isUnlimited,
    max_points: maxPoints
  });
  for (let i = 0; i < questions.length; i++) {
    await dbInsert('test_questions', { test_id: test.id, ...questions[i], sort_order: i });
  }
  closeModal('create-test-modal');
  showToast(`Test erstellt! Code: ${code}`, 'success');
  renderTests();
}

async function toggleTestActive(testId, active) {
  await _sb.from('tests').update({ is_active: active, start_time: active ? new Date().toISOString() : null }).eq('id', testId);
  if (active) {
    const test = testsData.find(t => t.id === testId);
    if (test && typeof notifyUsers === 'function') {
      const classObj = schoolClasses.find(c => c.id === test.class_id);
      const subject = subjects.find(s => s.id === test.subject_id);
      const students = await dbGet('profiles', { school_id: currentProfile.school_id, role: 'student', class_name: classObj?.name });
      if (students.length > 0) {
        await notifyUsers(
          currentProfile.school_id,
          'Test gestartet',
          `${escapeHtml(subject?.name || 'Fach')}: ${escapeHtml(test.title)} ist jetzt aktiv! Code: ${escapeHtml(test.access_code)}`,
          'test',
          students.map(s => s.id)
        );
      }
    }
  }
  showToast(active ? 'Test gestartet!' : 'Test gestoppt', 'success');
  renderTests();
}

async function deleteTest(id) {
  if (!confirm('Test löschen? Alle Antworten gehen verloren!')) return;
  await dbDelete('test_questions', { test_id: id });
  await dbDelete('test_submissions', { test_id: id });
  await dbDelete('tests', { id });
  showToast('Gelöscht', 'success');
  renderTests();
}

async function startTest(testId) {
  const test = testsData.find(t => t.id === testId);
  if (!test || !test.is_active) { showToast('Test nicht aktiv', 'error'); return; }
  const questions = await dbGet('test_questions', { test_id: testId });
  questions.sort((a, b) => a.sort_order - b.sort_order);
  currentTest = { ...test, questions };
  await dbInsert('test_submissions', { test_id: testId, student_id: currentUser.id });
  renderTestTaking();
}

function renderTestTaking() {
  if (!currentTest) return;
  const el = document.getElementById('test-taking-content');
  const timeHtml = currentTest.is_unlimited ? '<span class="badge badge-green">Kein Zeitlimit</span>' :
    `<span id="test-timer" class="badge badge-red">Verbleibend: ${currentTest.time_limit_minutes}:00</span>`;
  el.innerHTML = `
    <div class="card mb-20">
      <div class="flex-between">
        <h2>${escapeHtml(currentTest.title)}</h2>
        ${timeHtml}
      </div>
      ${currentTest.description ? `<p style="margin-top:8px;color:var(--text-secondary);font-size:0.875rem">${escapeHtml(currentTest.description)}</p>` : ''}
      <div style="margin-top:8px;font-size:0.813rem;color:var(--text-muted)">Maximale Punktzahl: ${currentTest.max_points}</div>
    </div>
    <form id="test-form" onsubmit="submitTest(event)">
      ${currentTest.questions.map((q, i) => {
        let inputHtml = '';
        if (q.question_type === 'mc') {
          const opts = q.options || [];
          inputHtml = opts.map((opt, oi) => `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer;transition:all 0.2s">
              <input type="checkbox" name="q_${q.id}" value="${oi + 1}" style="accent-color:var(--accent)">
              <span style="font-size:0.875rem">${escapeHtml(opt)}</span>
            </label>
          `).join('');
        } else if (q.question_type === 'true_false') {
          inputHtml = `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer">
              <input type="radio" name="q_${q.id}" value="true" style="accent-color:var(--accent)"> Richtig
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer">
              <input type="radio" name="q_${q.id}" value="false" style="accent-color:var(--accent)"> Falsch
            </label>`;
        } else if (q.question_type === 'number') {
          inputHtml = `<input type="number" step="any" class="input-field" name="q_${q.id}" placeholder="Deine Antwort">`;
        } else {
          inputHtml = `<textarea class="input-field" name="q_${q.id}" rows="3" placeholder="Deine Antwort..."></textarea>`;
        }
        return `<div class="card mb-12" style="padding:20px">
          <div class="flex gap-8 mb-12" style="align-items:center">
            <span style="background:var(--accent);color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0">${i + 1}</span>
            <strong style="font-size:0.938rem">${escapeHtml(q.question_text)}</strong>
            <span class="text-muted" style="font-size:0.75rem;margin-left:auto">${q.points} Pkt.</span>
          </div>
          ${inputHtml}
        </div>`;
      }).join('')}
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%">Test abgeben</button>
    </form>`;
  navigateTo('test-taking');
  if (!currentTest.is_unlimited && currentTest.time_limit_minutes) startTestTimer(currentTest.time_limit_minutes);
}

let testTimerInterval = null;
function startTestTimer(minutes) {
  let remaining = minutes * 60;
  const timerEl = document.getElementById('test-timer');
  testTimerInterval = setInterval(() => {
    remaining--;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    if (timerEl) timerEl.textContent = `Verbleibend: ${m}:${String(s).padStart(2, '0')}`;
    if (remaining <= 0) {
      clearInterval(testTimerInterval);
      showToast('Zeit abgelaufen! Test wird automatisch abgegeben.', 'error');
      document.getElementById('test-form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  }, 1000);
}

async function submitTest(e) {
  e.preventDefault();
  if (testTimerInterval) clearInterval(testTimerInterval);
  const form = document.getElementById('test-form');
  const submissions = await dbGet('test_submissions', { test_id: currentTest.id, student_id: currentUser.id });
  const submission = submissions[0];
  for (const q of currentTest.questions) {
    let answer = null;
    if (q.question_type === 'mc') {
      const checked = form.querySelectorAll(`input[name="q_${q.id}"]:checked`);
      answer = Array.from(checked).map(c => c.value);
    } else if (q.question_type === 'true_false') {
      const checked = form.querySelector(`input[name="q_${q.id}"]:checked`);
      answer = checked ? checked.value : null;
    } else {
      const input = form.querySelector(`[name="q_${q.id}"]`);
      answer = input ? input.value : null;
    }
    let earned = 0;
    if (q.question_type === 'mc' && q.correct_answer && answer) {
      const correct = q.correct_answer.split(',').map(s => s.trim());
      const matches = answer.filter(a => correct.includes(a));
      earned = Math.round((matches.length / correct.length) * q.points);
    } else if (q.question_type === 'true_false' && q.correct_answer) {
      earned = answer === q.correct_answer ? q.points : 0;
    } else if (q.question_type === 'number' && q.correct_answer) {
      earned = parseFloat(answer) === parseFloat(q.correct_answer) ? q.points : 0;
    }
    await dbInsert('test_answers', {
      submission_id: submission.id,
      question_id: q.id,
      answer: answer,
      points_earned: earned
    });
  }
  const allAnswers = await dbGet('test_answers', { submission_id: submission.id });
  const totalPoints = allAnswers.reduce((sum, a) => sum + (a.points_earned || 0), 0);
  await _sb.from('test_submissions').update({ submitted_at: new Date().toISOString(), total_points: totalPoints }).eq('id', submission.id);
  showToast(`Test abgegeben! ${totalPoints}/${currentTest.max_points} Punkte`, 'success');
  currentTest = null;
  navigateTo('tests');
}

async function viewTestResults(testId) {
  const test = testsData.find(t => t.id === testId);
  if (!test) return;
  const submissions = await dbGet('test_submissions', { test_id: testId });
  const el = document.getElementById('test-results-content');
  let html = `<div class="card mb-20"><h2>${escapeHtml(test.title)} - Ergebnisse</h2>
    <div style="font-size:0.813rem;color:var(--text-secondary);margin-top:4px">${submissions.length} Abgaben &middot; Max: ${test.max_points} Punkte</div></div>`;
  if (submissions.length === 0) {
    html += '<div class="text-muted">Noch keine Abgaben</div>';
  } else {
    html += '<div class="table-wrapper"><table><thead><tr><th>Schüler</th><th>Punkte</th><th>Note</th><th>Bewertung</th><th>Sichtbar</th><th></th></tr></thead><tbody>';
    for (const sub of submissions) {
      const student = (await dbGet('profiles', { id: sub.student_id }))[0];
      html += `<tr>
        <td><strong>${escapeHtml(student?.full_name || 'Unbekannt')}</strong></td>
        <td>${sub.total_points || 0} / ${test.max_points}</td>
        <td><input type="text" class="input-field" value="${sub.grade || ''}" onchange="updateSubmissionGrade('${sub.id}', this.value)" style="width:60px;text-align:center"></td>
        <td><textarea class="input-field" onchange="updateSubmissionFeedback('${sub.id}', this.value)" rows="1" placeholder="Feedback..." style="min-width:200px">${escapeHtml(sub.feedback || '')}</textarea></td>
        <td><label class="toggle-switch"><input type="checkbox" ${sub.visible_to_student ? 'checked' : ''} onchange="toggleSubmissionVisible('${sub.id}', this.checked)"><span class="toggle-slider"></span></label></td>
        <td><button class="btn btn-ghost btn-sm" onclick="viewSubmissionDetails('${sub.id}')">Details</button></td>
      </tr>`;
    }
    html += '</tbody></table></div>';
  }
  el.innerHTML = html;
  navigateTo('test-results');
}

async function updateSubmissionGrade(subId, grade) {
  await _sb.from('test_submissions').update({ grade }).eq('id', subId);
  showToast('Note gespeichert', 'success');
}

async function updateSubmissionFeedback(subId, feedback) {
  await _sb.from('test_submissions').update({ feedback }).eq('id', subId);
  showToast('Feedback gespeichert', 'success');
}

async function toggleSubmissionVisible(subId, visible) {
  await _sb.from('test_submissions').update({ visible_to_student: visible }).eq('id', subId);
  showToast(visible ? 'Ergebnis sichtbar gemacht' : 'Ergebnis versteckt', 'success');
}

async function viewSubmissionDetails(subId) {
  const answers = await dbGet('test_answers', { submission_id: subId });
  const submission = (await dbGet('test_submissions', { id: subId }))[0];
  let html = `<h3 class="mb-16">Details - ${submission?.total_points || 0} Punkte</h3>`;
  for (const a of answers) {
    const q = currentTest?.questions?.find(qu => qu.id === a.question_id) || {};
    html += `<div class="card mb-8" style="padding:12px">
      <div class="flex-between">
        <strong style="font-size:0.875rem">${escapeHtml(q.question_text || 'Frage')}</strong>
        <span class="badge ${a.points_earned > 0 ? 'badge-green' : 'badge-red'}">${a.points_earned}/${q.points}</span>
      </div>
      <div style="font-size:0.813rem;margin-top:6px;color:var(--text-secondary)">Antwort: ${JSON.stringify(a.answer)}</div>
    </div>`;
  }
  alert(html.replace(/<[^>]+>/g, '\n'));
}
