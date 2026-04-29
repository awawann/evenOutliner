import { EvenBetterSdk } from '@jappyjan/even-better-sdk';
import { OsEventTypeList } from '@evenrealities/even_hub_sdk';

interface Task {
    id: string;
    text: string;
    level: number;
    isExpanded: boolean;
}

const connectBtn = document.querySelector<HTMLButtonElement>('#connect-btn')!;
const taskListEl = document.querySelector<HTMLUListElement>('#task-list')!;
const glassesPreviewEl = document.querySelector<HTMLDivElement>('#glasses-preview')!;
const menuBtn = document.querySelector<HTMLButtonElement>('#menu-btn')!;
const settingsPanel = document.querySelector<HTMLDivElement>('#settings-panel')!;
const spacingRange = document.querySelector<HTMLInputElement>('#spacing-range')!;

let tasks: Task[] = JSON.parse(localStorage.getItem('outliner-tasks-v10') || '[]');
if (tasks.length === 0) {
    tasks.push({ id: Date.now().toString(), text: '', level: 0, isExpanded: true });
}

let cursorIndex = 0;

const sdk = new EvenBetterSdk();
const page = sdk.createPage('outliner-v10');
const listElement = page.addListElement([]);

listElement
    .setPosition((p) => p.setX(10).setY(10))
    .setSize((s) => s.setWidth(550).setHeight(300));

menuBtn.onclick = () => {
    settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block';
};

spacingRange.oninput = () => {
    document.documentElement.style.setProperty('--line-spacing', `${spacingRange.value}px`);
};

function getVisibleTasks(): Task[] {
    const visible: Task[] = [];
    let skipLevel = -1;
    tasks.forEach(task => {
        if (skipLevel !== -1 && task.level > skipLevel) return;
        skipLevel = task.isExpanded ? -1 : task.level;
        visible.push(task);
    });
    return visible;
}

function getBlockRange(index: number) {
    const start = index;
    let end = index;
    const baseLevel = tasks[index].level;
    for (let i = index + 1; i < tasks.length; i++) {
        if (tasks[i].level > baseLevel) end = i;
        else break;
    }
    return { start, end, count: end - start + 1 };
}

async function syncToGlasses() {
    const visibleTasks = getVisibleTasks();
    if (cursorIndex >= visibleTasks.length) cursorIndex = Math.max(0, visibleTasks.length - 1);

    glassesPreviewEl.innerHTML = '';
    const displayItems: string[] = [];

    visibleTasks.forEach((task, index) => {
        const taskIdx = tasks.findIndex(t => t.id === task.id);
        const hasChildren = taskIdx < tasks.length - 1 && tasks[taskIdx + 1].level > task.level;
        const indent = '\u00A0\u00A0'.repeat(task.level);
        const prefix = hasChildren ? (task.isExpanded ? '▼ ' : '▶ ') : '• ';
        const displayText = `${indent}${prefix}${task.text || '(empty)'}`;
        
        const div = document.createElement('div');
        div.className = 'preview-item' + (index === cursorIndex ? ' is-selected' : '');
        div.textContent = displayText;
        glassesPreviewEl.appendChild(div);
        displayItems.push(displayText);
    });

    listElement.setItems(displayItems.length > 0 ? displayItems : ['No tasks.']);
    listElement.setSelectItemIndex(cursorIndex);
    await page.render();
    localStorage.setItem('outliner-tasks-v10', JSON.stringify(tasks));
}

function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

async function renderFullList(focusId?: string, focusAtStart: boolean = false) {
    const visibleTasks = getVisibleTasks();
    taskListEl.innerHTML = '';

    visibleTasks.forEach((task, vIndex) => {
        const taskIndex = tasks.findIndex(t => t.id === task.id);
        const li = document.createElement('li');
        li.className = 'task-item';
        li.style.paddingLeft = `${task.level * 24}px`;

        const hasChildren = taskIndex < tasks.length - 1 && tasks[taskIndex + 1].level > task.level;
        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.textContent = hasChildren ? (task.isExpanded ? '▼ ' : '▶ ') : '• ';
        expandIcon.onclick = () => { task.isExpanded = !task.isExpanded; renderFullList(task.id); };

        const textarea = document.createElement('textarea');
        textarea.className = 'task-editor';
        textarea.value = task.text;
        textarea.placeholder = vIndex === 0 && tasks.length === 1 ? '最初のタスクを入力...' : '';
        textarea.rows = 1;
        
        textarea.oninput = () => {
            task.text = textarea.value;
            autoResize(textarea);
            syncToGlasses();
        };

        textarea.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newTask = { id: Date.now().toString(), text: '', level: task.level, isExpanded: true };
                tasks.splice(taskIndex + 1, 0, newTask);
                renderFullList(newTask.id, true);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) { if (task.level > 0) task.level--; }
                else { task.level++; }
                renderFullList(task.id);
            } else if (e.key === 'ArrowUp' && e.ctrlKey) {
                e.preventDefault();
                if (taskIndex > 0) {
                    const block = getBlockRange(taskIndex);
                    const moved = tasks.splice(block.start, block.count);
                    tasks.splice(taskIndex - 1, 0, ...moved);
                    renderFullList(task.id);
                }
            } else if (e.key === 'ArrowDown' && e.ctrlKey) {
                e.preventDefault();
                const block = getBlockRange(taskIndex);
                if (block.end < tasks.length - 1) {
                    const nextBlock = getBlockRange(block.end + 1);
                    const moved = tasks.splice(block.start, block.count);
                    tasks.splice(block.start + nextBlock.count, 0, ...moved);
                    renderFullList(task.id);
                }
            } else if (e.key === 'ArrowUp' && !e.ctrlKey) {
                if (textarea.selectionStart === 0) {
                    e.preventDefault();
                    const prevTextarea = taskListEl.children[vIndex - 1]?.querySelector('textarea') as HTMLTextAreaElement;
                    if (prevTextarea) {
                        prevTextarea.focus();
                        prevTextarea.setSelectionRange(0, 0);
                    }
                }
            } else if (e.key === 'ArrowDown' && !e.ctrlKey) {
                if (textarea.selectionStart === textarea.value.length) {
                    e.preventDefault();
                    const nextTextarea = taskListEl.children[vIndex + 1]?.querySelector('textarea') as HTMLTextAreaElement;
                    if (nextTextarea) {
                        nextTextarea.focus();
                        nextTextarea.setSelectionRange(0, 0);
                    }
                }
            } else if (e.key === '.' && e.ctrlKey) {
                e.preventDefault();
                task.isExpanded = !task.isExpanded;
                renderFullList(task.id);
            } else if (e.key === 'Backspace' && textarea.value === '' && tasks.length > 1) {
                const prevId = visibleTasks[vIndex - 1]?.id;
                tasks.splice(taskIndex, 1);
                renderFullList(prevId);
            }
        };

        textarea.onfocus = () => {
            cursorIndex = vIndex;
            syncToGlasses();
        };

        li.appendChild(expandIcon);
        li.appendChild(textarea);
        taskListEl.appendChild(li);
        autoResize(textarea);

        if (focusId === task.id) {
            setTimeout(() => {
                textarea.focus();
                if (focusAtStart) textarea.setSelectionRange(0, 0);
            }, 0);
        }
    });
    syncToGlasses();
}

sdk.addEventListener(async (event) => {
    const visibleTasks = getVisibleTasks();
    const type = event.jsonData?.eventType;
    if (type === OsEventTypeList.SCROLL_TOP_EVENT) cursorIndex = Math.max(0, cursorIndex - 1);
    else if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT) cursorIndex = Math.min(visibleTasks.length - 1, cursorIndex + 1);
    else if (type === OsEventTypeList.CLICK_EVENT) {
        const selectedTask = visibleTasks[cursorIndex];
        if (selectedTask) selectedTask.isExpanded = !selectedTask.isExpanded;
    }
    renderFullList();
});

connectBtn.addEventListener('click', async () => {
    try {
        await EvenBetterSdk.getRawBridge();
        await renderFullList();
        alert('Connected!');
    } catch (e) { console.error(e); }
});

renderFullList();
