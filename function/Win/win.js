    import {lib,game,ui,get,ai,_status} from '../../../../noname.js'
    
    lib.init.css(lib.assetURL + 'extension/五花米线/function/Win', 'win');
    	
    lib.onover.push(function(bool) {
        const addToWinner = character => {
            winner.push(character.name1);
            if (character.name2) winner.push(character.name2);
        };
        const processCharacters = characters => {
            characters.forEach(character => addToWinner(character));
        };
        
        //单独获取玩家总场次及胜场
        if(!lib.config.extension_五花米线_winner_player){
            game.saveConfig('extension_五花米线_winner_player',{changci:0,shengchang:0});
        }
        
        lib.config.extension_五花米线_winner_player.changci++;
        if(bool === true){
            lib.config.extension_五花米线_winner_player.shengchang++;
        }
        game.saveConfig('extension_五花米线_winner_player',lib.config.extension_五花米线_winner_player);
        
        // 获取模式类型
        const modeType = lib.config.all.mode.find(mode => lib.configOL[mode+'_mode'] || mode!='connect'&&lib.config.mode === mode);
       
        if(!lib.config.extension_五花米线_winner[modeType]) lib.config.extension_五花米线_winner[modeType] = {};
        
        // 场次统计
        game.filterPlayer2(player => {
            for(let name of get.nameList(player)){
                if(!lib.config.extension_五花米线_winner[modeType][name]) {
                    lib.config.extension_五花米线_winner[modeType][name] = {
                        changci:0,
                        shengchang:0,
                        pingju:0,
                        mechangci:0,
                        meshengchang:0,
                        mepingju:0
                    };
                }
                lib.config.extension_五花米线_winner[modeType][name].changci++;
                
                // 记录玩家使用的武将
                if(player==game.me) {
                    if(!lib.config.extension_五花米线_winner[modeType][name].mechangci) {
                        lib.config.extension_五花米线_winner[modeType][name].mechangci = 0;
                        lib.config.extension_五花米线_winner[modeType][name].meshengchang = 0;
                        lib.config.extension_五花米线_winner[modeType][name].mepingju = 0;
                    }
                    lib.config.extension_五花米线_winner[modeType][name].mechangci++;
                }
                
                if (bool !== true && bool !== false) {
                    lib.config.extension_五花米线_winner[modeType][name].pingju++;
                    if(player==game.me) lib.config.extension_五花米线_winner[modeType][name].mepingju++;
                }
            }
        });
    
        // 胜负判定
        const winner = [];
        const zhu = game.zhu;
        if (zhu) {
            if (zhu.isAlive()) {
                addToWinner(zhu);
                processCharacters(zhu.getFriends(null, true));
            } else {
                const nei = game.filterPlayer2(p => !p.getFriends(null, true).length);
                const hasOther = game.filterPlayer(p => !nei.includes(p) && p !== zhu).length;
    
                if (nei.length) {
                    if (!hasOther) {
                        processCharacters(nei.filter(p => p.isAlive()));
                    } else {
                        processCharacters(zhu.getEnemies(null, true).filter(p => !nei.includes(p)));
                    }
                } else {
                    processCharacters(zhu.getEnemies(null, true));
                }
            }
        } else {
            if (bool === true) {
                addToWinner(game.me);
                processCharacters(game.me.getFriends(null, true));
            } else if (bool === false) {
                const alive = game.filterPlayer();
                const target = alive.length === 1 ? alive[0] : alive[0].getEnemies(null, false).length ? game.me : alive[0];
    
                addToWinner(target);
                processCharacters(target.getFriends(null, true));
            }
        }
    
        // 记录胜场
        if (bool === true || bool === false){
            for(let name of winner){
                lib.config.extension_五花米线_winner[modeType][name].shengchang++;
                if(game.me && get.nameList(game.me).includes(name)) {
                    lib.config.extension_五花米线_winner[modeType][name].meshengchang++;
                }
            }
        }
        game.saveConfig('extension_五花米线_winner', lib.config.extension_五花米线_winner);
    });
    
    game.winInit=function(){//初始化函数
        let allPackList = lib.config.all.characters.slice(0);
        allPackList.addArray(Object.keys(lib.characterPack));
        
        game.saveConfig('extension_五花米线_winner',{});
        game.saveConfig('extension_五花米线_winner_player',{changci:0,shengchang:0});
        for (let mode of lib.config.all.mode) {
            if(mode=='connect')continue;
            lib.config['extension_五花米线_winner'][mode]={};
            for(let name of allPackList){
                for(let character in lib.characterPack[name]){
                    lib.config['extension_五花米线_winner'][mode][character]={
                        changci:0,
                        shengchang:0,
                        pingju:0,
                        mechangci:0,
                        meshengchang:0,
                        mepingju:0
                    };
                };
            };
        };
        game.saveConfig('extension_五花米线_winner',lib.config['extension_五花米线_winner']);
    };
    game.openWinDialog=function(flag){//打开菜单
        //初始化
        const modeType = lib.config.all.mode.find(mode => lib.configOL[mode+'_mode'] || mode!='connect'&&lib.config.mode === mode);
        _status.sortOrder=false;
        _status.sortBy='总场次';
        _status.zhanjiMode=modeType;
        _status.showPlayerStats=false; // 新增状态：是否显示玩家数据
        
        if(!lib.config.extension_五花米线_winner_player){
            game.saveConfig('extension_五花米线_winner_player',{changci:0,shengchang:0});
        }
        
        game.pause2();
        
        const winBg = ui.create.div(document.body, '.winBg'); //整个页面的大背景
        const winBgHide=ui.create.div('.winBgHide',winBg);
        ui.create.div('.close',winBgHide,function(){
            winBg.delete();
            game.resume2();
        });
        const leftBg=ui.create.div('.leftBg',winBgHide);
        const rightBg=ui.create.div('.rightBg',winBgHide);
        
        //标题文字
        const head=ui.create.div('.modeText',lib.translate[_status.zhanjiMode] ,winBgHide);
        //玩家场次及胜场
        const playHead=ui.create.div('.playHead','玩家总场次：'+(lib.config.extension_五花米线_winner_player.changci||0)+'&nbsp;&nbsp;&nbsp;玩家总胜场：'+(lib.config.extension_五花米线_winner_player.shengchang||0),winBgHide);
        
        // 新增：玩家数据切换按钮
        const playerStatsBtn = ui.create.div('.playerStatsBtn', '仅查看自己',winBgHide, function() {
            _status.showPlayerStats = !_status.showPlayerStats;
            this.classList.toggle('active', _status.showPlayerStats);
            createCharacter(_status.zhanjiMode, _status.sortBy, _status.sortOrder);
        });
        playerStatsBtn.classList.toggle('active', _status.showPlayerStats);
        
        //搜索按钮
        let shuru = null;
        const sousuo = ui.create.div('.sousuo', winBgHide, function(event) {
            event.stopPropagation();
            event.preventDefault();
            
            if (!shuru) {
                shuru = document.createElement('input');
                shuru.type = 'text';
                shuru.className = 'sousuoInput';
                shuru.placeholder = '';
                shuru.style.position = 'absolute';
                if(flag){
                    document.body.appendChild(shuru);
                }else{
                    ui.window.appendChild(shuru);
                }
        
                const closeInput = function(e) {
                    if (shuru.style.display === 'block' &&
                        !shuru.contains(e.target) &&
                        e.target !== sousuo) {
                        shuru.style.display = 'none';
                        document.removeEventListener('mousedown', closeInput);
                    }
                };
                document.addEventListener('mousedown', closeInput);
            }
            
            shuru.style.display = 'block';
            setTimeout(() => shuru.focus(), 50);
        });
        
        document.addEventListener('keydown', function(event) {
            if (shuru && shuru.style.display === 'block' && event.key === 'Enter') {
                let inputValue = shuru.value.trim();
                if (inputValue) createCharacter(_status.zhanjiMode,_status.sortBy,_status.sortOrder,inputValue);
                shuru.value = '';
                shuru.style.display = 'none';
            };
        });
        
        //信息管理按钮
        ui.create.div('.dataLbtn',winBgHide,function(){
            const dataBg = ui.create.div(document.body, '.dataBg',function(){
                dataBg.delete();
            }); //整个页面的黑色底图
            
            const dataImage = ui.create.div('.dataImage', dataBg); //数据管理底图
            const dataLbtns = ui.create.div('.dataLbtns', dataImage); //所有按钮的内容总体位置（滚动条）
            
            
            const daoru=ui.create.div('.lbtn',dataLbtns,function(){
                const url = 'extension/五花米线/function/Win/files';
                const dataBg = ui.create.div(document.body, '.dataBg', function(event) {
                    if (event.target === dataBg) dataBg.delete();
                });
                const dataChooseBg = ui.create.div('.dataChooseBg', dataBg);
                ui.create.div('.text', '选择你要导入的数据', dataChooseBg);
                const removedataBg = ui.create.div('.dataBigBg', dataChooseBg);
                let num = 1;
                game.getFileList(url, function(folders, files) {
                    if (!files.length) {
                        alert('extension/五花米线/Win/files/  路径下无文件');
                        dataBg.delete();
                        return;
                    };
                    for (let name of files) {
                        const fileName = name.split('.')[0];
                        const node = ui.create.div('.dataBtn', removedataBg, function(event) {
                            if (confirm('是否导入：' + fileName + '  的数据？')) game.readFileAsText('extension/五花米线/function/Win/files/' + name, function(data) {
                                let obj;
                                try {
                                    obj = JSON.parse(data);
                                } catch(e) {
                                    console.error("解析错误：",e);
                                }
                                if (obj && obj.data && typeof obj.data === 'object'&&obj.player_winner && typeof obj.player_winner === 'object') {
                                    game.saveConfig('extension_五花米线_winner',obj.data);
                                    game.saveConfig('extension_五花米线_winner_player',obj.player_winner);
                                    createCharacter(_status.zhanjiMode,_status.sortBy,_status.sortOrder);
                                    alert('导入成功！');
                                } else {
                                    alert('读取失败，文件格式必须是包含data及player_winner对象属性的对象');
                                }
                            });
                        });
                        ui.create.div('.text', fileName, node);
                    };
                }, function() {
                    if (num == 1) alert('请检查文件夹extension/五花米线/function/Win/files  是否存在');
                    num++;
                    dataBg.delete();
                });
            });
            ui.create.div('.text','导入数据',daoru);
            
            const mergeBtn = ui.create.div('.lbtn', dataLbtns, function() {
                const url = 'extension/五花米线/function/Win/files';
                const dataBg = ui.create.div(document.body, '.dataBg', function(event) {
                    if (event.target === dataBg) dataBg.delete();
                });
                const dataChooseBg = ui.create.div('.dataChooseBg', dataBg);
                ui.create.div('.text', '选择要合并的数据文件', dataChooseBg);
                const removedataBg = ui.create.div('.dataBigBg', dataChooseBg);
                let num = 1;
                game.getFileList(url, function(folders, files) {
                    if (!files.length) {
                        alert('路径下无文件');
                        dataBg.delete();
                        return;
                    };
                    for (let name of files) {
                        const fileName = name.split('.')[0];
                        const node = ui.create.div('.dataBtn', removedataBg, function(event) {
                            if (confirm('是否合并：' + fileName + ' 的数据？')) game.readFileAsText('extension/五花米线/function/Win/files/' + name, function(data) {
                                let obj;
                                try {
                                    obj = JSON.parse(data);
                                } catch(e) {
                                    console.error("解析错误：",e);
                                    alert('文件格式错误');
                                    return;
                                }
                                if (obj && obj.data && typeof obj.data === 'object' && obj.player_winner && typeof obj.player_winner === 'object') {
                                    // 合并玩家数据
                                    lib.config.extension_五花米线_winner_player.changci += obj.player_winner.changci || 0;
                                    lib.config.extension_五花米线_winner_player.shengchang += obj.player_winner.shengchang || 0;
                                    
                                    // 合并武将数据
                                    for (let mode in obj.data) {
                                        if (!lib.config.extension_五花米线_winner[mode]) {
                                            lib.config.extension_五花米线_winner[mode] = {};
                                        }
                                        for (let char in obj.data[mode]) {
                                            if (!lib.config.extension_五花米线_winner[mode][char]) {
                                                lib.config.extension_五花米线_winner[mode][char] = {
                                                    changci: 0,
                                                    shengchang: 0,
                                                    pingju: 0,
                                                    mechangci: 0,
                                                    meshengchang: 0,
                                                    mepingju: 0
                                                };
                                            }
                                            const target = lib.config.extension_五花米线_winner[mode][char];
                                            const source = obj.data[mode][char];
                                            target.changci += source.changci || 0;
                                            target.shengchang += source.shengchang || 0;
                                            target.pingju += source.pingju || 0;
                                            target.mechangci += source.mechangci || 0;
                                            target.meshengchang += source.meshengchang || 0;
                                            target.mepingju += source.mepingju || 0;
                                        }
                                    }
                                    
                                    game.saveConfig('extension_五花米线_winner_player', lib.config.extension_五花米线_winner_player);
                                    game.saveConfig('extension_五花米线_winner', lib.config.extension_五花米线_winner);
                                    createCharacter(_status.zhanjiMode,_status.sortBy,_status.sortOrder);
                                    alert('合并成功！');
                                } else {
                                    alert('文件格式必须包含data及player_winner对象');
                                }
                            });
                        });
                        ui.create.div('.text', fileName, node);
                    };
                }, function() {
                    if (num == 1) alert('请检查文件夹是否存在');
                    num++;
                    dataBg.delete();
                });
            });
            ui.create.div('.text','合并数据',mergeBtn);
            const daochu = ui.create.div('.lbtn', dataLbtns, function () {
                const url = 'extension/五花米线/function/Win/files';
                if (confirm('是否导出战绩数据至路径：' + url + '/')) {
                    const now = new Date();
                    const timestamp = [
                        now.getFullYear(),
                        String(now.getMonth() + 1).padStart(2, '0'),
                        String(now.getDate()).padStart(2, '0'),
                    ].join('') + '_' + [
                        String(now.getHours()).padStart(2, '0'),
                        String(now.getMinutes()).padStart(2, '0'),
                        String(now.getSeconds()).padStart(2, '0')
                    ].join('');
                    const nickname = lib.config.connect_nickname || '无名玩家';
                    const safeNickname = nickname.replace(/[\\/:*?"<>|]/g, ''); // 移除非法字符
                    const filename = `${safeNickname}_战绩数据_${timestamp}.json`;
                    const exportData = {
                        player: nickname,
                        timestamp: now.toISOString(),
                        player_winner:lib.config.extension_五花米线_winner_player,
                        data: lib.config['extension_五花米线_winner']
                    };
                    
                    let num = 1;
                    game.writeFile(JSON.stringify(exportData, null, 4), url, filename, () => {
                        if (num === 1) alert(`已保存至：${url}/${filename}`);
                        num++;
                    });
                }
            });
            ui.create.div('.text', '导出数据', daochu);
            
            const shanchu=ui.create.div('.lbtn',dataLbtns,function(){
                if (confirm('是否清空战绩数据？')){
                    game.saveConfig('extension_五花米线_winner',{});
                    game.winInit();
                    createCharacter(_status.zhanjiMode,_status.sortBy,_status.sortOrder);
                };
            });
            ui.create.div('.text','清空数据',shanchu);
        });
        
        //战绩横条
        const rightTop=ui.create.div('.rightTop',winBgHide);
        const wjTop=ui.create.div('.wjTop','武将',rightTop);
        
        const textBg=ui.create.div('.textBg',rightTop)
        for (let name of ['总场次', '胜场', '胜率', '败场', '平局']) {
            const div = ui.create.div('.text', textBg);
            const textSpan = document.createElement('span');
            textSpan.textContent = name;
        
            // 创建箭头
            const arrow = document.createElement('span');
            arrow.className = 'sort-arrow';
            arrow.innerHTML = '▼'; // 使用实体字符作为箭头
            div.append(textSpan, arrow);
        
            if (name === _status.sortBy) {
                arrow.classList.toggle('active', _status.sortOrder);
            }
            // 点击事件
            div.onclick = () => {
                const isSameField = name === _status.sortBy;
                _status.sortBy = name;
                _status.sortOrder = isSameField ? !_status.sortOrder : false;
                document.querySelectorAll('.sort-arrow').forEach(arr => arr.classList.remove('active'));
                arrow.classList.toggle('active', _status.sortOrder);
                createCharacter(_status.zhanjiMode, name, _status.sortOrder,_status.winnerNames);
            };
        }
        
        function createCharacter(mode, sortBy = '总场次', sortOrder, name) {//添加武将函数
            _status.zhanjiMode=mode;
            _status.sortBy=sortBy;
            _status.sortOrder=sortOrder;
            if(name)_status.winnerNames=name;
            else{
                delete _status.winnerNames;
            };
            rightBg.innerHTML = '';
            head.innerHTML = lib.translate[_status.zhanjiMode] ;
            playHead.innerHTML='玩家总场次：'+lib.config.extension_五花米线_winner_player.changci+'&nbsp;&nbsp;&nbsp;玩家总胜场：'+lib.config.extension_五花米线_winner_player.shengchang;
            // 收集角色数据
            const charactersData = [];
            for (let character in lib.config['extension_五花米线_winner'][mode]) {
                if(!lib.config['extension_五花米线_winner'][mode][character])lib.config['extension_五花米线_winner'][mode][character]={
                    changci:0,
                    shengchang:0,
                    pingju:0,
                    mechangci:0,
                    meshengchang:0,
                    mepingju:0
                };
                const data = lib.config['extension_五花米线_winner'][mode][character];
                
                // 根据是否显示玩家数据选择不同的统计字段
                const changci = _status.showPlayerStats ? data.mechangci || 0 : data.changci || 0;
                const shengchang = _status.showPlayerStats ? data.meshengchang || 0 : data.shengchang || 0;
                const pingju = _status.showPlayerStats ? data.mepingju || 0 : data.pingju || 0;
                
                const shenglv = changci === 0 ? 0 : ((shengchang / changci) * 100);
                const baichang = changci - shengchang - pingju || 0;
                
                if(name){
                    let libtranslate = flag?lib._cust_translate:lib.translate;
                    if (libtranslate[character]&&libtranslate[character].includes(name)||character.includes(name)){
                        // 显示玩家数据时只添加 mechangci > 0 的记录
                        if (!_status.showPlayerStats || (_status.showPlayerStats && data.mechangci > 0)) {
                            charactersData.push({
                                character: character,
                                changci: changci,
                                shengchang: shengchang,
                                shenglv: shenglv,
                                baichang: baichang,
                                pingju: pingju
                            });
                        }
                    };
                    continue;
                }
                else {
                    // 显示玩家数据时只添加 mechangci > 0 的记录
                    // 显示全部数据时添加 changci > 0 的记录
                    if ((_status.showPlayerStats && data.mechangci > 0) || 
                        (!_status.showPlayerStats && data.changci > 0)) {
                        charactersData.push({
                            character: character,
                            changci: changci,
                            shengchang: shengchang,
                            shenglv: shenglv,
                            baichang: baichang,
                            pingju: pingju
                        });
                    }
                };
            };
            
            // 定义排序依据的映射
            const sortMapping = {
                '胜率': 'shenglv',
                '胜场': 'shengchang',
                '总场次': 'changci',
                '平局': 'pingju',
                '败场': 'baichang'
            };
            
            if (!sortMapping[sortBy])return;
            
            // 获取排序的key
            const sortKey = sortMapping[sortBy];
            
            // 定义排序函数
            const sortFunction = (a, b) => {
                let valueA = a[sortKey];
                let valueB = b[sortKey];
                if (sortKey === 'shenglv') {
                    valueA = parseFloat(valueA);
                    valueB = parseFloat(valueB);
                }
                if (valueB > valueA) return sortOrder? -1 : 1;
                if (valueB < valueA) return sortOrder? 1 : -1;
                return 0;
            };
            
            // 按照指定的依据和方向排序
            charactersData.sort(sortFunction);
            
            // 生成排序后的HTML元素
            charactersData.forEach((data) => {
                const characterBg = ui.create.div('.characterBg', rightBg,function(){
                    if (flag) {
						lib._yjcm_wj_preview(data.character, characterImage);
					} else {
						 game.createCharacterSkill(data.character);
					}
                });
                const characterHead = ui.create.div('.characterHead', characterBg);
                const characterImage = ui.create.div('.characterImage', characterHead);
                
                //图片懒加载
                characterImage.dataset.char = data.character;
                characterImage.style.minHeight = '80px';
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.setBackground(entry.target.dataset.char, 'character');
                            observer.unobserve(entry.target);
                        }
                    });
                }, {
                    rootMargin: '200px'
                });
                observer.observe(characterImage);
                const name =flag? lib._cust_translate[data.character]:get.slimName(data.character);
                ui.create.div('.characterName', name, characterHead);
        
                const xinxiBg = ui.create.div('.xinxiBg', characterBg);
                const texts = [
                    data.changci + '场',
                    data.shengchang + '场',
                    data.shenglv.toFixed(2) + '%',
                    data.baichang + '场',
                    data.pingju + '场'
                ];
                texts.forEach((text) => {
                    ui.create.div('.xinxiText', text, xinxiBg);
                });
            });
            
            rightBg.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        const modeButtons = [];
        for (let mode of lib.config.all.mode) {
            if (mode === 'connect') continue;
            const node = ui.create.div('.modeLbtn', lib.translate[mode], leftBg, function () {
                modeButtons.forEach(button => {
                    if (button !== this) {
                        button.classList.remove('active');
                    }
                });
                this.classList.add('active');
                createCharacter(mode,_status.sortBy,_status.sortOrder);
            });
            if(mode==_status.zhanjiMode)node.classList.add('active');
            modeButtons.push(node);
        };
        
        //初始化
        createCharacter(_status.zhanjiMode,_status.sortBy,_status.sortOrder);
    };
    
    lib.arenaReady.push(function() {
        ui.create.system('战绩', () => {
            game.openWinDialog();
        });
        //初始化
        if(!lib.config['extension_五花米线_winner'])game.winInit();
    });