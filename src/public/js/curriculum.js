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

                    html += `
            <div class="lesson-item" data-id="${lesson.id}" style="background: var(--color-black); border: 1px solid var(--color-gray-mid); padding: 0.75rem 1rem; margin-bottom: 0.5rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <i data-lucide="grip-vertical" class="text-muted" style="cursor: grab;"></i>
                <i data-lucide="${icon}" class="text-primary icon-sm"></i>
                <span style="color: var(--color-white); font-size: 0.95rem;">${lesson.title}</span>
              </div>
              <button class="edit-lesson-btn" data-id="${lesson.id}" data-section="${section.id}" data-title="${lesson.title}" data-type="${lesson.type}" style="background:none; border:none; color: var(--color-gray-light); cursor: pointer;"><i data-lucide="edit-2" class="icon-sm"></i></button>
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
            });
        });
    }

    // Handle Add Section
    document.getElementById('addSectionBtn').addEventListener('click', async () => {
        const title = prompt('Enter new section title:');
        if (!title) return;

        try {
            await fetch(`/api/v1/courses/${window.COURSE_ID}/sections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, order: 99 })
            });
            loadCurriculum();
        } catch (err) { }
    });

    // Handle Lesson Submission
    document.getElementById('lessonForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const lessonId = document.getElementById('modalLessonId').value;
        const sectionId = document.getElementById('modalSectionId').value;
        const title = document.getElementById('lessonTitle').value;
        const type = document.getElementById('lessonType').value;

        try {
            if (lessonId) {
                // Update
                await fetch(`/api/v1/courses/lessons/${lessonId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, type })
                });
            } else {
                // Create
                await fetch(`/api/v1/courses/sections/${sectionId}/lessons`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, type, order: 99 })
                });
            }

            document.getElementById('lessonModal').style.display = 'none';
            loadCurriculum();
        } catch (err) { }
    });

    // Kickoff
    loadCurriculum();
});
