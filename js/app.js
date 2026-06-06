class App {
    constructor() {
        this.svg = document.getElementById('main-canvas');
        this.pathsLayer = document.getElementById('paths-layer');
        this.handlesLayer = document.getElementById('handles-layer');
        this.objectsLayer = document.getElementById('objects-layer');
        
        this.pathEditor = new PathEditor(this.svg, this.pathsLayer, this.handlesLayer);
        this.animationEngine = new AnimationEngine(this.objectsLayer, this.pathEditor);
        this.timeline = new Timeline(document.querySelector('.timeline-container'), this.animationEngine, this.pathEditor);
        this.exporter = new Exporter(this.animationEngine, this.pathEditor);
        
        this.editingObjectId = null;
        this.selectedObjectId = null;
        
        window.pathEditor = this.pathEditor;
        window.animationEngine = this.animationEngine;
        window.exporter = this.exporter;
        window.app = this;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadDefaultDemo();
        this.setupTabSwitching();
        this.updateSource();
    }
    
    loadDefaultDemo() {
        this.pathEditor.clearAll();
        
        this.pathEditor.loadPreset('heart');
        const heartPathId = this.pathEditor.currentPathId;
        
        this.pathEditor.loadPreset('circle');
        const circlePathId = this.pathEditor.currentPathId;
        
        this.pathEditor.loadPreset('spiral');
        const spiralPathId = this.pathEditor.currentPathId;
        
        const obj1 = this.animationEngine.createObject({
            name: '红心',
            type: 'diamond',
            color: '#ff6b6b',
            size: 24,
            pathId: heartPathId,
            startTime: 0,
            duration: 4,
            speed: 1,
            easing: 'ease-in-out',
            loop: 'repeat',
            orientToPath: true
        });
        
        const obj2 = this.animationEngine.createObject({
            name: '蓝星',
            type: 'star',
            color: '#4facfe',
            size: 28,
            pathId: circlePathId,
            startTime: 0.5,
            duration: 3,
            speed: 1,
            easing: 'linear',
            loop: 'alternate',
            orientToPath: true
        });
        
        const obj3 = this.animationEngine.createObject({
            name: '绿三角',
            type: 'triangle',
            color: '#52c41a',
            size: 26,
            pathId: spiralPathId,
            startTime: 1,
            duration: 5,
            speed: 0.8,
            easing: 'bounce',
            loop: 'repeat',
            orientToPath: true
        });
        
        this.updateObjectsList();
        this.updatePathSelectors();
        this.timeline.update();
        this.animationEngine.render();
        this.updateSource();
        
        setTimeout(() => {
            this.animationEngine.play();
        }, 500);
    }
    
    bindEvents() {
        document.getElementById('btn-play').addEventListener('click', () => {
            this.animationEngine.play();
        });
        
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.animationEngine.pause();
        });
        
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.animationEngine.reset();
            this.timeline.updatePlayhead(0);
        });
        
        document.getElementById('tool-select').addEventListener('click', () => {
            this.setActiveTool('select', 'tool-select');
        });
        
        document.getElementById('tool-add').addEventListener('click', () => {
            this.setActiveTool('add', 'tool-add');
        });
        
        document.getElementById('tool-delete').addEventListener('click', () => {
            this.setActiveTool('delete', 'tool-delete');
        });
        
        document.getElementById('path-type').addEventListener('change', (e) => {
            this.pathEditor.setPathType(e.target.value);
        });
        
        document.getElementById('btn-load-preset').addEventListener('click', () => {
            const preset = document.getElementById('preset-paths').value;
            if (preset) {
                this.pathEditor.loadPreset(preset);
                this.updatePathSelectors();
                this.updateObjectsList();
                this.timeline.update();
                this.updateSource();
                document.getElementById('preset-paths').value = '';
            }
        });
        
        document.getElementById('btn-clear-path').addEventListener('click', () => {
            if (confirm('确定要清空当前路径吗？')) {
                this.pathEditor.clearCurrentPath();
                this.updateSource();
            }
        });
        
        document.getElementById('btn-add-object').addEventListener('click', () => {
            if (this.pathEditor.paths.filter(p => p.points.length >= 2).length === 0) {
                alert('请先创建至少一条路径！');
                return;
            }
            this.openObjectModal();
        });
        
        document.getElementById('modal-cancel').addEventListener('click', () => {
            this.closeObjectModal();
        });
        
        document.getElementById('modal-save').addEventListener('click', () => {
            this.saveObjectFromModal();
        });
        
        document.getElementById('obj-size').addEventListener('input', (e) => {
            document.getElementById('obj-size-value').textContent = e.target.value;
        });
        
        document.getElementById('obj-speed').addEventListener('input', (e) => {
            document.getElementById('obj-speed-value').textContent = parseFloat(e.target.value).toFixed(1);
        });
        
        document.getElementById('show-anim-source').addEventListener('change', () => this.updateSource());
        document.getElementById('show-controls-source').addEventListener('change', () => this.updateSource());
        
        document.getElementById('btn-export-smil').addEventListener('click', () => {
            this.exporter.exportSMIL();
        });
        
        document.getElementById('btn-export-css').addEventListener('click', () => {
            this.exporter.exportCSS();
        });
        
        document.getElementById('btn-export-js').addEventListener('click', () => {
            this.exporter.exportJS();
        });
        
        this.animationEngine.onTimeUpdate = (time) => {
            this.timeline.updatePlayhead(time);
        };
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('input, textarea, select')) {
                e.preventDefault();
                if (this.animationEngine.playing) {
                    this.animationEngine.pause();
                } else {
                    this.animationEngine.play();
                }
            }
            if (e.code === 'KeyR' && !e.target.matches('input, textarea, select')) {
                this.animationEngine.reset();
                this.timeline.updatePlayhead(0);
            }
        });
        
        setInterval(() => this.updateSource(), 1000);
    }
    
    setActiveTool(tool, buttonId) {
        this.pathEditor.setTool(tool);
        document.querySelectorAll('.btn-tool').forEach(btn => btn.classList.remove('active'));
        document.getElementById(buttonId).classList.add('active');
    }
    
    setupTabSwitching() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('tab-' + tab).classList.add('active');
                
                if (tab === 'timeline') {
                    this.timeline.update();
                }
                if (tab === 'source') {
                    this.updateSource();
                }
            });
        });
    }
    
    updatePathSelectors() {
        const select = document.getElementById('obj-path');
        select.innerHTML = '';
        
        const validPaths = this.pathEditor.paths.filter(p => p.points.length >= 2);
        validPaths.forEach(path => {
            const option = document.createElement('option');
            option.value = path.id;
            option.textContent = path.name;
            select.appendChild(option);
        });
        
        if (validPaths.length > 0) {
            select.value = validPaths[0].id;
        }
    }
    
    openObjectModal(objId = null) {
        this.editingObjectId = objId;
        const modal = document.getElementById('object-modal');
        modal.classList.remove('hidden');
        
        this.updatePathSelectors();
        
        if (objId) {
            document.getElementById('modal-title').textContent = '编辑动画对象';
            const obj = this.animationEngine.objects.find(o => o.id === objId);
            if (obj) {
                document.getElementById('obj-name').value = obj.name;
                document.getElementById('obj-type').value = obj.type;
                document.getElementById('obj-color').value = obj.color;
                document.getElementById('obj-size').value = obj.size;
                document.getElementById('obj-size-value').textContent = obj.size;
                document.getElementById('obj-path').value = obj.pathId;
                document.getElementById('obj-start').value = obj.startTime;
                document.getElementById('obj-duration').value = obj.duration;
                document.getElementById('obj-speed').value = obj.speed;
                document.getElementById('obj-speed-value').textContent = obj.speed.toFixed(1);
                document.getElementById('obj-easing').value = obj.easing;
                document.getElementById('obj-loop').value = obj.loop;
                document.getElementById('obj-orient').checked = obj.orientToPath;
            }
        } else {
            document.getElementById('modal-title').textContent = '添加动画对象';
            document.getElementById('obj-name').value = '对象 ' + (this.animationEngine.objects.length + 1);
            document.getElementById('obj-type').value = 'circle';
            document.getElementById('obj-color').value = '#ff6b6b';
            document.getElementById('obj-size').value = 20;
            document.getElementById('obj-size-value').textContent = '20';
            document.getElementById('obj-start').value = 0;
            document.getElementById('obj-duration').value = 3;
            document.getElementById('obj-speed').value = 1;
            document.getElementById('obj-speed-value').textContent = '1.0';
            document.getElementById('obj-easing').value = 'linear';
            document.getElementById('obj-loop').value = 'none';
            document.getElementById('obj-orient').checked = true;
        }
    }
    
    closeObjectModal() {
        document.getElementById('object-modal').classList.add('hidden');
        this.editingObjectId = null;
    }
    
    saveObjectFromModal() {
        const data = {
            name: document.getElementById('obj-name').value || '未命名对象',
            type: document.getElementById('obj-type').value,
            color: document.getElementById('obj-color').value,
            size: parseInt(document.getElementById('obj-size').value),
            pathId: document.getElementById('obj-path').value,
            startTime: parseFloat(document.getElementById('obj-start').value) || 0,
            duration: parseFloat(document.getElementById('obj-duration').value) || 3,
            speed: parseFloat(document.getElementById('obj-speed').value) || 1,
            easing: document.getElementById('obj-easing').value,
            loop: document.getElementById('obj-loop').value,
            orientToPath: document.getElementById('obj-orient').checked
        };
        
        if (this.editingObjectId) {
            this.animationEngine.updateObject(this.editingObjectId, data);
        } else {
            this.animationEngine.createObject(data);
        }
        
        this.closeObjectModal();
        this.updateObjectsList();
        this.timeline.update();
        this.animationEngine.render();
        this.updateSource();
    }
    
    selectObject(objId) {
        this.selectedObjectId = objId;
        this.updateObjectsList();
        
        const obj = this.animationEngine.objects.find(o => o.id === objId);
        if (obj) {
            this.animationEngine.setTime(obj.startTime);
            this.timeline.updatePlayhead(obj.startTime);
        }
    }
    
    updateObjectsList() {
        const container = document.getElementById('objects-list');
        container.innerHTML = '';
        
        if (this.animationEngine.objects.length === 0) {
            container.innerHTML = '<div style="text-align:center;color:#999;padding:30px;">暂无动画对象，点击"添加动画对象"按钮创建</div>';
            return;
        }
        
        this.animationEngine.objects.forEach(obj => {
            const path = this.pathEditor.paths.find(p => p.id === obj.pathId);
            const pathName = path ? path.name : '未绑定';
            
            const item = document.createElement('div');
            item.className = 'object-item' + (this.selectedObjectId === obj.id ? ' selected' : '');
            item.innerHTML = `
                <div class="object-header">
                    <div class="object-name">
                        <span class="object-color-dot" style="background:${obj.color}"></span>
                        <span>${obj.name}</span>
                    </div>
                    <div class="object-actions">
                        <button class="btn btn-small" data-action="edit" data-id="${obj.id}">编辑</button>
                        <button class="btn btn-small btn-danger" data-action="delete" data-id="${obj.id}">删除</button>
                    </div>
                </div>
                <div class="object-info">
                    <span>类型: ${this.getObjectTypeLabel(obj.type)}</span>
                    <span>路径: ${pathName}</span>
                    <span>开始: ${obj.startTime.toFixed(1)}s</span>
                    <span>时长: ${(obj.duration / obj.speed).toFixed(1)}s</span>
                    <span>缓动: ${this.getEasingLabel(obj.easing)}</span>
                    <span>循环: ${this.getLoopLabel(obj.loop)}</span>
                </div>
            `;
            
            item.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const id = btn.dataset.id;
                    
                    if (action === 'edit') {
                        this.openObjectModal(id);
                    } else if (action === 'delete') {
                        if (confirm('确定要删除这个动画对象吗？')) {
                            this.animationEngine.deleteObject(id);
                            if (this.selectedObjectId === id) this.selectedObjectId = null;
                            this.updateObjectsList();
                            this.timeline.update();
                            this.animationEngine.render();
                            this.updateSource();
                        }
                    }
                });
            });
            
            item.addEventListener('click', () => {
                this.selectObject(obj.id);
            });
            
            container.appendChild(item);
        });
    }
    
    getObjectTypeLabel(type) {
        const labels = {
            circle: '圆形',
            square: '方形',
            triangle: '三角形',
            diamond: '菱形',
            star: '星形'
        };
        return labels[type] || type;
    }
    
    getEasingLabel(easing) {
        const labels = {
            linear: '线性',
            ease: '缓动',
            'ease-in': '缓入',
            'ease-out': '缓出',
            'ease-in-out': '缓入缓出',
            bounce: '弹跳',
            elastic: '弹性'
        };
        return labels[easing] || easing;
    }
    
    getLoopLabel(loop) {
        const labels = {
            none: '不循环',
            repeat: '重复',
            alternate: '往返'
        };
        return labels[loop] || loop;
    }
    
    updateSource() {
        const includeAnim = document.getElementById('show-anim-source').checked;
        const includeControls = document.getElementById('show-controls-source').checked;
        
        const source = this.pathEditor.getSVGSource(includeAnim, includeControls);
        document.getElementById('svg-source').value = source;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
