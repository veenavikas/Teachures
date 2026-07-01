// /src/public/js/curriculum.js

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('curriculumContainer');
    if (!container || !window.COURSE_ID) return;

    // 1. Fetch Curriculum
    async function loadCurriculum() {
        try {
            const res = await fetch(`/api/v1/courses/${window.COURSE_ID}/sections`);
            const data = await res.json();

            if (data.success) {
                renderCurriculum(data.data);
            }
        } catch (err) {
            console.error('Failed to load curriculum', err);
            container.innerHTML = '<p class="text-danger">Error loading curriculum.</p>';
        }
    }

    // 2. Render UI
    function renderCurriculum(sections) {
        if (sections.length === 0) {
            container.innerHTML = '<p class="text-muted text-center" style="margin-top: 2rem;">No sections yet. Add your first section below.</p>';
            return;
        }

        let html = '';
        sections.forEach(section => {
            html += `
        <div class="section-card" data-id="${section.id}" style="border: 1px solid var(--color-gray-mid); background: #151515; margin-bottom: 1.5rem; border-radius: 4px; overflow: hidden;">
          <div style="background: var(--color-gray-dark); padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-gray-mid);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i data-lucide="grip-vertical" class="text-muted" style="cursor: grab;"></i>
              <strong style="color: var(--color-white); font-size: 1.1rem;">${section.title}</strong>
            </div>
            <button class="btn add-lesson-btn" data-section="${section.id}" style="padding: 0.25rem 0.5rem; background: transparent; border: 1px solid var(--color-gray-light); color: var(--color-white); font-size: 0.8rem;"><i data-lucide="plus" class="icon-sm"></i> Lesson</button>
          </div>
          
          <div class="lesson-list" data-section="${section.id}" style="padding: 1rem; min-height: 50px;">
      `;

            if (section.lessons && section.lessons.length) {
                section.lessons.forEach(lesson => {
                    let icon = 'video';
                    if (lesson.type === 'ARTICLE') icon = 'file-text';
                    if (lesson.type === 'QUIZ') icon = 'help-circle';
                    if (lesson.type === 'LIVE') icon = 'radio';
                    if (lesson.type === 'ASSIGNMENT') icon = 'clipboard';

                    html += `
            <div class="lesson-item" data-id="${lesson.id}" style="background: var(--color-black); border: 1px solid var(--color-gray-mid); padding: 0.75rem 1rem; margin-bottom: 0.5rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <i data-lucide="grip-vertical" class="text-muted" style="cursor: grab;"></i>
                <i data-lucide="${icon}" class="text-primary icon-sm"></i>
                <span style="color: var(--color-white); font-size: 0.95rem;">${lesson.title}</span>
                ${lesson.dripDays > 0 ? `<span class="text-muted" style="font-size: 0.8rem; margin-left: 10px;"><i data-lucide="clock" class="icon-sm"></i> Drip: ${lesson.dripDays} days</span>` : ''}
              </div>
              <button class="edit-lesson-btn" data-id="${lesson.id}" data-section="${section.id}" data-title="${lesson.title}" data-type="${lesson.type}" data-drip="${lesson.dripDays || 0}" data-live-url="${lesson.liveUrl || ''}" data-live-start="${lesson.liveStartTime || ''}" data-attachments='${lesson.attachments ? JSON.stringify(lesson.attachments).replace(/'/g, "&#39;") : ""}' style="background:none; border:none; color: var(--color-gray-light); cursor: pointer;"><i data-lucide="edit-2" class="icon-sm"></i></button>
            </div>
          `;
                });
            }

            html += `
          </div>
        </div>
      `;
        });

        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
        initSortable();
        attachLessonListeners();
    }

    // 3. Init SortableJS
    function initSortable() {
        new Sortable(container, {
            handle: '.grip-vertical',
            animation: 150,
            onEnd: function (evt) {
                // Here we would sync section orders with backend
                console.log('Section reordered');
            }
        });

        document.querySelectorAll('.lesson-list').forEach(list => {
            new Sortable(list, {
                group: 'shared',
                handle: '.grip-vertical',
                animation: 150,
                onEnd: function (evt) {
                    // Sync lesson order/section with backend
                    console.log('Lesson reordered');
                }
            });
        });
    }

    // 4. Modal listeners
    function attachLessonListeners() {
        document.querySelectorAll('.add-lesson-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById('lessonModal').style.display = 'flex';
                document.getElementById('lessonModalTitle').innerText = 'Add New Lesson';
                document.getElementById('lessonForm').reset();
                document.getElementById('modalSectionId').value = e.target.closest('button').dataset.section;
                document.getElementById('modalLessonId').value = '';
                document.getElementById('lessonDripDays').value = 0;
                document.getElementById('lessonLiveUrl').value = '';
                document.getElementById('lessonLiveStartTime').value = '';
                document.getElementById('assignmentDescription').value = '';
                document.getElementById('assignmentDeadline').value = '';
            });
        });

        document.querySelectorAll('.edit-lesson-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const el = e.target.closest('button');
                document.getElementById('lessonModal').style.display = 'flex';
                document.getElementById('lessonModalTitle').innerText = 'Edit Lesson';
                document.getElementById('modalLessonId').value = el.dataset.id;
                document.getElementById('modalSectionId').value = el.dataset.section;
                document.getElementById('lessonTitle').value = el.dataset.title;
                document.getElementById('lessonType').value = el.dataset.type;
                document.getElementById('lessonDripDays').value = el.dataset.drip || 0;
                
                document.getElementById('lessonLiveUrl').value = el.dataset.liveUrl || '';
                if(el.dataset.liveStart) {
                    // Format for datetime-local
                    const d = new Date(el.dataset.liveStart);
                    if (!isNaN(d.getTime())) {
                        document.getElementById('lessonLiveStartTime').value = d.toISOString().slice(0,16);
                    }
                } else {
                    document.getElementById('lessonLiveStartTime').value = '';
                }
                
                try {
                    const attachmentsRaw = el.dataset.attachments;
                    if(attachmentsRaw) {
                        const parsed = JSON.parse(attachmentsRaw);
                        document.getElementById('lessonAttachments').value = JSON.stringify(parsed, null, 2);
                    } else {
                        document.getElementById('lessonAttachments').value = '';
                    }
                } catch(e) {
                    document.getElementById('lessonAttachments').value = '';
                }
            });
        });
    }

    // Handle Add Section
    document.getElementById('addSectionBtn').addEventListener('click', () => {
        let modal = document.getElementById('customSectionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'customSectionModal';
            modal.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;';
            modal.innerHTML = `
                <div style="background:var(--color-black, #111); border:1px solid var(--color-gray-mid, #333); padding:2rem; border-radius:8px; width:400px; max-width:90%;">
                    <h3 style="color:#fff; margin-top:0;">Add New Section</h3>
                    <input type="text" id="customSectionTitle" class="form-control" placeholder="Section Title" style="width:100%; margin:1rem 0;" />
                    <div style="display:flex; justify-content:flex-end; gap:10px;">
                        <button id="cancelSectionBtn" class="btn btn-outline" style="color:#fff;">Cancel</button>
                        <button id="saveSectionBtn" class="btn btn-primary">Save</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('cancelSectionBtn').addEventListener('click', () => {
                modal.style.display = 'none';
                document.getElementById('customSectionTitle').value = '';
            });

            document.getElementById('saveSectionBtn').addEventListener('click', async () => {
                const title = document.getElementById('customSectionTitle').value.trim();
                if (!title) return;
                try {
                    await fetch(`/api/v1/courses/${window.COURSE_ID}/sections`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title, order: 99 })
                    });
                    modal.style.display = 'none';
                    document.getElementById('customSectionTitle').value = '';
                    loadCurriculum();
                } catch (err) { console.error(err); }
            });
        }
        modal.style.display = 'flex';
        document.getElementById('customSectionTitle').focus();
    });

    // Quiz Builder Logic
    const typeSelect = document.getElementById('lessonType');
    const videoZone = document.getElementById('videoUploadGroup');
    const quizZone = document.getElementById('quizBuilderZone');
    const liveZone = document.getElementById('liveSessionZone');
    const assignmentZone = document.getElementById('assignmentZone');
    const questionsContainer = document.getElementById('questionsContainer');
    let questionCount = 0;

    typeSelect.addEventListener('change', (e) => {
        videoZone.style.display = 'none';
        quizZone.style.display = 'none';
        liveZone.style.display = 'none';
        assignmentZone.style.display = 'none';

        if (e.target.value === 'QUIZ') {
            quizZone.style.display = 'block';
        } else if (e.target.value === 'VIDEO') {
            videoZone.style.display = 'block';
        } else if (e.target.value === 'LIVE') {
            liveZone.style.display = 'block';
        } else if (e.target.value === 'ASSIGNMENT') {
            assignmentZone.style.display = 'block';
        }
    });

    document.getElementById('addQuestionBtn').addEventListener('click', () => {
        questionCount++;
        const qDiv = document.createElement('div');
        qDiv.className = 'question-block';
        qDiv.style = 'margin-bottom: 1rem; padding: 1rem; background: var(--color-black); border: 1px solid var(--color-gray-mid); border-radius: 4px;';
        qDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <strong>Question ${questionCount}</strong>
                <button type="button" class="text-danger" style="background:none; border:none; cursor:pointer;" onclick="this.parentElement.parentElement.remove()">Remove</button>
            </div>
            <input type="text" class="form-control q-text" placeholder="Enter question text" required style="margin-bottom: 0.5rem;">
            <div class="options-container">
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <input type="radio" name="correct_${questionCount}" value="0" required>
                    <input type="text" class="form-control opt-text" placeholder="Option A" required>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <input type="radio" name="correct_${questionCount}" value="1">
                    <input type="text" class="form-control opt-text" placeholder="Option B" required>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <input type="radio" name="correct_${questionCount}" value="2">
                    <input type="text" class="form-control opt-text" placeholder="Option C">
                </div>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <input type="radio" name="correct_${questionCount}" value="3">
                    <input type="text" class="form-control opt-text" placeholder="Option D">
                </div>
            </div>
        `;
        questionsContainer.appendChild(qDiv);
    });

    const aiGenerateQuizBtn = document.getElementById('aiGenerateQuizBtn');
    if (aiGenerateQuizBtn) {
        aiGenerateQuizBtn.addEventListener('click', async () => {
            const descriptionContent = document.getElementById('lessonDescription') ? document.getElementById('lessonDescription').value : '';
            const lessonId = document.getElementById('modalLessonId') ? document.getElementById('modalLessonId').value : null;

            if (!descriptionContent && !lessonId) {
                return alert('Please enter a lesson description first, or save the lesson to generate an AI quiz.');
            }

            const originalText = aiGenerateQuizBtn.innerHTML;
            aiGenerateQuizBtn.disabled = true;
            aiGenerateQuizBtn.innerHTML = '<i data-lucide="loader-2" class="spin" style="margin-right:8px; display:inline-block; width:16px; height:16px;"></i> Generating...';
            lucide.createIcons();

            try {
                const res = await fetch(`/api/v1/ai/generate-quiz`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lessonId, content: descriptionContent })
                });

                const data = await res.json();
                if (data.success && data.questions) {
                    data.questions.forEach(q => {
                        questionCount++;
                        const qDiv = document.createElement('div');
                        qDiv.className = 'question-block';
                        qDiv.style = 'margin-bottom: 1rem; padding: 1rem; background: var(--color-black); border: 1px solid var(--color-gray-mid); border-radius: 4px;';
                        
                        let optionsHtml = '';
                        q.options.forEach((opt, idx) => {
                            optionsHtml += `
                                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <input type="radio" name="correct_${questionCount}" value="${idx}" ${idx === q.correctOptionIndex ? 'checked' : ''} required>
                                    <input type="text" class="form-control opt-text" value="${opt.replace(/"/g, '&quot;')}" required>
                                </div>
                            `;
                        });
                        // Add explanation if we have one
                        const explanationText = q.explanation ? `<div><small style="color:var(--color-primary);">AI Note: ${q.explanation.replace(/"/g, '&quot;')}</small></div>` : '';

                        qDiv.innerHTML = `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <strong>Question ${questionCount}</strong>
                                <button type="button" class="text-danger" style="background:none; border:none; cursor:pointer;" onclick="this.parentElement.parentElement.remove()">Remove</button>
                            </div>
                            <input type="text" class="form-control q-text" value="${q.text.replace(/"/g, '&quot;')}" required style="margin-bottom: 0.5rem;">
                            <div class="options-container">
                                ${optionsHtml}
                            </div>
                            ${explanationText}
                        `;
                        questionsContainer.appendChild(qDiv);
                    });
                    alert('AI Quiz generated successfully! You can review and edit the questions above.');
                } else {
                    alert(data.message || 'Failed to generate quiz.');
                }
            } catch (err) {
                console.error(err);
                alert('An error occurred during AI quiz generation.');
            } finally {
                aiGenerateQuizBtn.disabled = false;
                aiGenerateQuizBtn.innerHTML = originalText;
                lucide.createIcons();
            }
        });
    }

    // Handle Lesson Submission
    document.getElementById('lessonForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const lessonId = document.getElementById('modalLessonId').value;
        const sectionId = document.getElementById('modalSectionId').value;
        const title = document.getElementById('lessonTitle').value;
        const type = document.getElementById('lessonType').value;
        const dripDays = parseInt(document.getElementById('lessonDripDays').value) || 0;
        const videoInput = document.getElementById('lessonVideo');
        const liveUrl = document.getElementById('lessonLiveUrl').value;
        const liveStartTime = document.getElementById('lessonLiveStartTime').value;
        const assignmentDescription = document.getElementById('assignmentDescription').value;
        const assignmentDeadline = document.getElementById('assignmentDeadline').value;
        const attachmentsStr = document.getElementById('lessonAttachments').value;

        const formData = new FormData();
        formData.append('title', title);
        formData.append('type', type);
        formData.append('order', 99);
        formData.append('dripDays', dripDays);
        if(type === 'LIVE') {
            formData.append('liveUrl', liveUrl);
            if(liveStartTime) {
                formData.append('liveStartTime', new Date(liveStartTime).toISOString());
            }
        }
        if(type === 'ASSIGNMENT') {
            formData.append('assignmentDescription', assignmentDescription);
            if(assignmentDeadline) {
                formData.append('assignmentDeadline', new Date(assignmentDeadline).toISOString());
            }
        }
        
        if (type === 'VIDEO' && videoInput && videoInput.files[0]) {
            formData.append('video', videoInput.files[0]);
        }
        
        if (attachmentsStr && attachmentsStr.trim() !== '') {
            try {
                const parsed = JSON.parse(attachmentsStr);
                formData.append('attachments', JSON.stringify(parsed));
            } catch(e) {
                return alert('Invalid JSON in Attachments field. Please verify the format: [{"name":"...","url":"..."}]');
            }
        }

        try {
            let actualLessonId = lessonId;
            let res;

            if (lessonId) {
                // Update
                res = await fetch(`/api/v1/courses/lessons/${lessonId}`, {
                    method: 'PUT',
                    headers: { 'Accept': 'application/json' },
                    body: formData
                });
            } else {
                // Create
                res = await fetch(`/api/v1/courses/sections/${sectionId}/lessons`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                    body: formData
                });
            }

            if (res.status === 401) {
                alert('Session expired. Please log in again to save your changes.');
                return;
            }

            const data = await res.json();
            if (!data.success) {
                alert('Failed to save lesson: ' + (data.message || 'Unknown error'));
                return;
            }
            
            if (!lessonId) {
                actualLessonId = data.data.id;
            }

            // If it's a quiz, save quiz data
            if (type === 'QUIZ' && actualLessonId) {
                const questions = Array.from(document.querySelectorAll('.question-block')).map(qDiv => {
                    const text = qDiv.querySelector('.q-text').value;
                    const optInputs = qDiv.querySelectorAll('.opt-text');
                    const radioInputs = qDiv.querySelectorAll('input[type="radio"]');
                    
                    const options = [];
                    optInputs.forEach((inp, idx) => {
                        if(inp.value.trim()) {
                            options.push({
                                id: idx + 1,
                                text: inp.value.trim(),
                                isCorrect: radioInputs[idx].checked
                            });
                        }
                    });

                    return { text, options };
                });

                const quizPayload = {
                    lessonId: actualLessonId,
                    title: title + ' Quiz',
                    passingScore: document.getElementById('quizPassingScore').value,
                    timeLimit: document.getElementById('quizTimeLimit').value,
                    pullRandomCount: document.getElementById('quizPullRandomCount').value,
                    questions
                };

                await fetch('/api/v1/courses/quizzes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(quizPayload)
                });
            }

            document.getElementById('lessonModal').style.display = 'none';
            loadCurriculum();
        } catch (err) {
            console.error(err);
        }
    });

    // Reset form states when modal opens
    document.querySelectorAll('.add-lesson-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            questionsContainer.innerHTML = '';
            questionCount = 0;
            typeSelect.value = 'VIDEO';
            typeSelect.dispatchEvent(new Event('change'));
        });
    });

    // Kickoff
    loadCurriculum();
    loadBankQuestions();

    // Question Bank Logic
    async function loadBankQuestions() {
        try {
            const res = await fetch(`/api/v1/courses/${window.COURSE_ID}/questions`);
            const data = await res.json();
            if(data.success) {
                const list = document.getElementById('bankQuestionsList');
                if(!list) return;
                list.innerHTML = '';
                
                if(data.data.length === 0) {
                    list.innerHTML = '<p class="text-muted">No questions in the bank yet.</p>';
                    return;
                }

                data.data.forEach(q => {
                    const div = document.createElement('div');
                    div.style = 'border: 1px solid var(--color-gray-mid); padding: 1rem; margin-bottom: 0.5rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;';
                    div.innerHTML = `
                        <div>
                            <strong>${q.text}</strong>
                            <div style="font-size: 0.85rem; color: var(--color-gray-light); margin-top: 0.25rem;">Points: ${q.points} | Type: ${q.type}</div>
                        </div>
                        <button class="btn btn-outline" style="color: var(--color-danger); border-color: var(--color-danger); padding: 0.25rem 0.5rem;" onclick="deleteBankQuestion('${q.id}')">Delete</button>
                    `;
                    list.appendChild(div);
                });
            }
        } catch(err) {
            console.error(err);
        }
    }

    const bankForm = document.getElementById('bankQuestionForm');
    if(bankForm) {
        bankForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = document.getElementById('bankQText').value;
            const points = document.getElementById('bankQPoints').value;
            
            const optInputs = document.querySelectorAll('.bank-opt-text');
            const radioInputs = document.querySelectorAll('input[name="bankCorrectOption"]');
            
            const options = [];
            optInputs.forEach((inp, idx) => {
                if(inp.value.trim()) {
                    options.push({
                        id: idx + 1,
                        text: inp.value.trim(),
                        isCorrect: radioInputs[idx].checked
                    });
                }
            });

            try {
                const res = await fetch(`/api/v1/courses/${window.COURSE_ID}/questions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, points, options })
                });
                const data = await res.json();
                if(data.success) {
                    bankForm.reset();
                    loadBankQuestions();
                } else {
                    alert(data.message);
                }
            } catch(err) {
                console.error(err);
            }
        });
    }

    window.deleteBankQuestion = async function(questionId) {
        if(!confirm('Are you sure you want to delete this question from the bank?')) return;
        try {
            await fetch(`/api/v1/courses/${window.COURSE_ID}/questions/${questionId}`, { method: 'DELETE' });
            loadBankQuestions();
        } catch(err) {
            console.error(err);
        }
    };

    // Cohort Logic
    loadCohorts();

    async function loadCohorts() {
        try {
            const res = await fetch(`/api/v1/courses/${window.COURSE_ID}/cohorts`);
            const data = await res.json();
            if(data.success) {
                const list = document.getElementById('cohortsList');
                if(!list) return;
                list.innerHTML = '';
                
                if(data.data.length === 0) {
                    list.innerHTML = '<p class="text-muted">No cohorts created yet.</p>';
                    return;
                }

                data.data.forEach(c => {
                    const div = document.createElement('div');
                    div.style = 'border: 1px solid var(--color-gray-mid); padding: 1rem; margin-bottom: 0.5rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;';
                    div.innerHTML = `
                        <div>
                            <strong>${c.name}</strong>
                            <div style="font-size: 0.85rem; color: var(--color-gray-light); margin-top: 0.25rem;">
                                Starts: ${new Date(c.startDate).toLocaleDateString()} | 
                                Enrollments: ${c._count.enrollments}
                            </div>
                        </div>
                        <button class="btn btn-outline" style="color: var(--color-danger); border-color: var(--color-danger); padding: 0.25rem 0.5rem;" onclick="deleteCohort('${c.id}')">Delete</button>
                    `;
                    list.appendChild(div);
                });
            }
        } catch(err) {
            console.error(err);
        }
    }

    const cohortForm = document.getElementById('cohortForm');
    if(cohortForm) {
        cohortForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('cohortName').value;
            const startDate = document.getElementById('cohortStartDate').value;
            const endDate = document.getElementById('cohortEndDate').value;
            
            try {
                const res = await fetch(`/api/v1/courses/${window.COURSE_ID}/cohorts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, startDate, endDate })
                });
                const data = await res.json();
                if(data.success) {
                    cohortForm.reset();
                    loadCohorts();
                } else {
                    alert(data.message);
                }
            } catch(err) {
                console.error(err);
            }
        });
    }

    window.deleteCohort = async function(cohortId) {
        if(!confirm('Are you sure you want to delete this cohort?')) return;
        try {
            await fetch(`/api/v1/courses/${window.COURSE_ID}/cohorts/${cohortId}`, { method: 'DELETE' });
            loadCohorts();
        } catch(err) {
            console.error(err);
        }
    };
});
