import { lib, game, ui, get, ai, _status } from "../../../noname.js";
import { gelinPack } from "../gelin/gelin.js";
import { characterPack } from "../character_qlwh/index.js";
import '../function/Win/win.js';
export async function precontent(config, pack) {
	// ← 接收配置参数
	//新建势力
	game.addGroup("hua", "华", "物华弥新", { color: "#FF00FF" });
	game.addGroup("meng", "联盟", "英雄联盟", { color: "#4169E1" });
	game.addGroup("ql_door", "门", "天涯门", { color: "#F4E50D" });
	gelinPack(lib, game, ui, get, ai, _status, "五花米线");
	//手动皮切
	lib.message.server.changeSkin_qlwh = function(...args) {
		if (lib.node.observing.includes(this)) {
			return;
		}
		const player = lib.playerOL[this.id];
		player.changeSkin(...args);
	}
	lib.arenaReady.push(function () {
		if (lib.hooks.refreshSkin && !lib.hooks.refreshSkin.some(i => i.name == "changeSkin")) {
			const changeSkin = function (name, skin) {
				if ((get.nameList(game.me) || []).includes(name) && game.me.skin.name != skin) {
					if (game.online) {
						game.send("changeSkin_qlwh", { characterName: name }, skin);
					} else {
						game.me.changeSkin({ characterName: name }, skin);
					}
				}
			};
			lib.hooks.refreshSkin.push(changeSkin);
		}
	});
	//导入五花米线武将包
	let skinCheck = true,
		characterSkinList;
	let [files] = await game.promises.getFileList(`extension/五花米线`);
	if (!files.some(file => file == "skin")) {
		skinCheck = false;
	} else {
		let [files] = await game.promises.getFileList(`extension/五花米线/skin`);
		if (!files.some(file => file == "image")) {
			skinCheck = false;
		}
	}
	if (skinCheck) {
		characterSkinList = (await game.promises.getFileList(`extension/五花米线/skin/image`))[0];
	}
	for (let packName in characterPack) {
		const pack = characterPack[packName];
		if (skinCheck) {
			for (let character in pack.character) {
				if (!characterSkinList.includes(character)) {
					continue;
				}
				if (!("characterSubstitute" in pack)) {
					pack.characterSubstitute = {};
				}
				if (!(character in pack.characterSubstitute)) {
					pack.characterSubstitute[character] = [];
				}
				const [folders, files] = await game.promises.getFileList(`extension/五花米线/skin/image/${character}`);
				if (files.length) {
					for (let file of files) {
						let skinName = `${character}_${get.pinyin(file.slice(0, -4), false).join("")}`;
						pack.characterSubstitute[character].push([skinName, [`${lib.device || lib.node ? "ext:" : "db:extension-"}五花米线/skin/image/${character}/${file}`]]);
					}
				}
			}
		}
		//导入武将包（包含皮肤）
		await game.import("character", function () {
			return pack;
		});
	}
	//导入五花米线卡牌包
	const qlwhCardResult = await import(`../character_qlwh/cardPack.js`).catch(e => alert(`在导入卡牌包“五花米线”时出现错误:\n${e.stack}`));
	const { cardPack: qlwhCardPack } = qlwhCardResult;
	if (qlwhCardPack) {
		for (const cardName in qlwhCardPack.card) {
			var card = qlwhCardPack.card[cardName];
			if (card.fullskin) {
				card.image = `ext:五花米线/skin/${cardName}.png`;
			}
			/*if (card.audio === true) {
			  card.audio = `ext:${extname}`;
			}*/
		}
	}
	game.import("card", () => qlwhCardPack);
	//导入天涯门武将包
	let result = await import(`../character_tym/index.js`).catch(e => alert(`在导入武将包“天涯门”时出现错误:\n${e.stack}`));
	const { characterPack: tymPack } = result;
	if (tymPack) {
		//统一加substitute图片路径
		for (const name in tymPack.characterSubstitute) {
			const info = tymPack.characterSubstitute[name];
			info.forEach(list => list[1].push(`ext:五花米线/skin/${list[0]}.jpg`));
		}
		for (let name in tymPack.character) {
			let info = tymPack.character[name];
			//加入原画和阵亡语音
			info.img ??= `extension/五花米线/skin/${name}.jpg`;
			info.dieAudios ??= [`ext:五花米线/audio/die/${name}.mp3`];
			//补上前缀
			const names = tymPack.translate[name];
			const list = names?.split("|");
			if (list?.length > 1) {
				tymPack.translate[name] = list.join("");
				tymPack.translate[name + "_prefix"] = list.slice(0, list.length - 1).join("|");
			}
		}
		game.import("character", () => tymPack);
	}
	//导入墨风雅韵武将包
	result = await import(`../character_mfyy/index.js`).catch(e => alert(`在导入武将包“墨风雅韵”时出现错误:\n${e.stack}`));
	let { characterPack: mfyyPack } = result;
	if (mfyyPack) {
		//统一加substitute图片路径
		for (const name in mfyyPack.characterSubstitute) {
			const info = mfyyPack.characterSubstitute[name];
			info.forEach(list => list[1].push(`ext:五花米线/skin/${list[0]}.jpg`));
		}
		for (let name in mfyyPack.character) {
			let info = mfyyPack.character[name];
			//加入原画和阵亡语音
			info.img ??= `extension/五花米线/skin/${name}.jpg`;
			info.dieAudios ??= [`ext:五花米线/audio/die/${name}.mp3`];
			//补上前缀
			const names = mfyyPack.translate[name];
			const list = names?.split("|");
			if (list?.length > 1) {
				mfyyPack.translate[name] = list.join("");
				mfyyPack.translate[name + "_prefix"] = list.slice(0, list.length - 1).join("|");
			}
		}
		game.import("character", () => mfyyPack);
	}
	//联机自由点将，感谢曼巴佬
	lib.skill._connect_free_choose = {
		trigger: {
			player: 'chooseButtonBegin'
		},
		filter(event, player) {
			if (!game.openConnect()) {
				return false;
			}
			const regexp = /^chooseCharacter(OL)?$/;
			return _status.connectMode
				// 不是联机模式的话不发动
				&& event.player
				// 是在线玩家选择
				&& (player == game.me
					|| player.isOnline()
				)
				// 不是在线玩家的话不管他
				&& (regexp.test(event.getParent().name)
					|| regexp.test(event.getParent(2).name)
				);
		},
		lastDo: true,
		silent: true,
		forceDie: true, // 虽然应该不会先死再选将但还是加下）
		forceOut: true,
		content() {
			game.broadcastAll(function (me, timeout_count, list) {
				let count = 0;
				let wsOnChooseButton

				function create(timeout) {
					let event = get.event();
					const trigger = event._trigger;
					const regexp = /^chooseButton(OL)?$/;
					if (trigger && regexp.test(trigger.name)) {
						event = trigger;
					};

					if (regexp.test(event.name)
						&& !event.onfree
						&& event.player == game.me
					) {
						_status.done = true;
						event.onfree = true;

						if (lib.onfree) lib.onfree.push(func);
						else func();

						const next = game.createEvent(
							'connect_free_choose_button_close' + get.id(),
							false,
							event
						);
						const originalFilter = event.filterButton;
						event.filterButton = function (...args) {
							if (_status.event.free_choose) {
								return true;
							};
							/* 自由选将时，不管怎样都可以选
							 * 防止选不了（
							 */
							return originalFilter.apply(this, args);
						};
						event.next.remove(next);
						event.after.push(next);
						next.source = event;
						next.setContent(function () {
							if (source && source.free_choose) {
								source.dialogxx?.close();
							};
							// 选完之后移除自由选将按钮
							if (ui.cheat2) {
								ui.cheat2.remove();
							};
							delete _status.done;
						});
						ui.create.cheat2 = function () {
							ui.cheat2 = ui.create.control(
								// 创建自由选将的按钮
								'自由选将',
								function () {
									ui.selected.buttons.forEach(button => {
										ui.click.button.call(button);
										// 取消选择已选择的将
									});
									if (event.free_choose) {
										event.dialogxx.close();
										event.free_choose = false;
										event.dialog = this.backup;
										event.dialog.open();
										delete this.backup;
										game.uncheck();
										game.check();
										// 关闭自由选将的对话框    								
									}
									else {
										event.dialog.close();
										// 隐藏原对话框
										event.dialogxx.videoId = event.dialog.videoId;
										if (event.dialog.players && !event.dialogxx.playersAdded) {
											event.dialogxx.players = [...event.dialogxx.buttons];
											event.dialogxx.friends = [];
											event.dialogxx.playersAdded = true;
										};
										this.backup = event.dialog;
										event.dialog = event.dialogxx;
										event.free_choose = true;
										event.dialogxx.open();
										game.uncheck();
										game.check();
									};
								}
							);
							if (lib.onfree) {
								ui.cheat2.classList.add('disabled');
							};
						};
						if (!ui.cheat2) {
							ui.create.cheat2();
							// 没有自由选将按钮的话就创建	                
						};
						if (timeout) {
							console.error(
								'playerid:' + game.onlineID || game.me.playerid,
								'\nerror: free choose button create timeout!',
								'\nnickname:' + get.connectNickname()
							);
						};

						function func() {
							// 获取联机可选武将
							event.dialogxx =
								ui.create.characterDialog(
									'heightset',
									function (name) {
										return !list.includes(name);
										// 屏蔽联机不能选的将
									}
								);
							// 点击自由选将按钮后弹出的对话框
							if (ui.cheat2) {
								ui.cheat2.classList.remove('disabled');
							};
						};
					};
				};

				// 超时重试
				setTimeout(
					function loop() {
						if (_status.done) return;

						create(true);

						if (!_status.done && count++ < timeout_count) {
							setTimeout(
								loop,
								2500
							);
						};
					},
					2500
				);

				create();
			}, game.me, game.getExtensionConfig('联机自由选将', 'timeout_count'), get.charactersOL());
		}
	};
	//月相
	((game.changeMoon = function (name) {
		const str = name || "";
		const next = game.createEvent("changeMoon");
		next.name = str;
		next.setContent(async function (event, trigger, player) {
			if (!event.name || event.name === "") {
				const moons = ["shi_moon", "xin_moon", "man_moon", "can_moon", "yingtu_moon", "kuitu_moon"];
				const index = Math.floor(Math.random() * 6); //随机出现编号为1~6的月相
				event.name = moons[index];
			}
			event.moonskill = event.name + "_skill"; //月相技能命名格式为“月相名称”+"_skill"
			game.addVideo("changeMoon", event.name);
			let parsedPath = "extension/五花米线/skin/";
			parsedPath += event.name + ".png";
			game.pause();
			await game.broadcastAll(
				(formattedPath, name, skill) => {
					const node = ui.create.div(".background.upper.moon");
					node.setBackgroundImage(formattedPath);
					node.style.backgroundSize = "cover";
					node.style.backgroundRepeat = "no-repeat";
					node.style.backgroundPosition = "center";
					node.destroy = () => {
						if (node.skill) {
							game.removeGlobalSkill(node.skill);
							if (node.system) {
								node.system.remove();
							}
						}
						node.classList.add("hidden");
						setTimeout(() => node.remove(), 3000);
						if (ui.moon == node) {
							ui.moon = null;
						}
					};
					if (ui.moon) {
						document.body.insertBefore(node, ui.moon);
						ui.moon.destroy();
					} else {
						node.classList.add("hidden");
						document.body.insertBefore(node, ui.window);
						ui.refresh(node);
						node.classList.remove("hidden");
					}
					ui.moon = node;
					if (!name) {
						return;
					}
					node.name = name;
					node.skill = skill;
					lib.setPopped(
						(node.system = ui.create.system(lib.translate[skill], null, true, true)),
						() => {
							const uiIntro = ui.create.dialog("hidden");
							uiIntro._place_text = uiIntro.add(ui.create.div(".text", lib.translate[`${skill}_info`]));
							uiIntro.add(ui.create.div(".placeholder.slim"));
							return uiIntro;
						},
						200
					);
					_status._moonPhase = name;
				},
				parsedPath,
				event.name,
				event.moonskill
			);
			game.resume();
			await game.addGlobalSkill(event.moonskill);
		});
	}),
		//每轮开始时，随机抽取一个本轮月相
		(lib.skill._changeMoon = {
			trigger: {
				player: "roundStart",
			},
			charlotte: true,
			forced: true,
			locked: true,
			filter(event, player) {
				if (!lib.config.extension_五花米线_ql_moonPhase) return false;
				return true;
			},
			async content(event, trigger, player) {
				await game.changeMoon();
			},
		}));
	//月相概率判定
	lib.element.player.ql_moonJudge = async function (request, log) {
		let evt = _status.event.getParent();
		var next = game.createEvent("ql_moonJudge");
		if (evt.skill) next.skill = evt.skill;
		next.player = this;
		next.request = request;
		next.setContent("ql_moonJudge");
		return next; //返回判定结果（是否成功）
	};
	lib.element.content.ql_moonJudge = [
		async (event, trigger, player) => {
			if (!event.request || typeof event.request != "number") {
				event.request = 50; //初始化概率为50
			}
			if (!event.extra || typeof event.extra != "number") {
				event.extra = 0; //初始化额外概率为0
			}
			if (!event.number || typeof event.number != "number") {
				event.number = 0; //初始化判定点数为0（尚未判定）
			}
			event.bool = false;
			await event.trigger("ql_moonJudge_Begin");
			if (event.fixedResult) {
				event.result = { cancelled: true, bool: event.fixedResult <= event.request };
				event.finish();
				return;
			}
		},
		async (event, trigger, player) => {
			const resultx = Math.floor(Math.random() * 100) + 1; //投掷点数为1~100之间的随机整数
			event.number += resultx;
			await event.trigger("ql_moonJudge");
			event.number += event.extra; //最终判定点数
		},
		async (event, trigger, player) => {
			if (event.request) event.bool = event.number <= event.request; //判定结果：小于等于概率则成功
			await event.trigger("ql_moonJudge_End");
			event.result = { cancelled: false, bool: event.bool };
		},
	];
	//致知，焕彰，守卫功能创建
	Object.assign(game, {
		openConnect() {
			return lib.config[`extension_五花米线_ql_connect`] === true;
		},
		openZhizhi() {
			return lib.config[`extension_五花米线_ql_zhizhi`] === true;
		},
		openHuanzhang() {
			return lib.config[`extension_五花米线_ql_huanzhang`] === true;
		},
		openGuard() {
			return lib.config[`extension_五花米线_ql_guard`] === true;
		},
	});
	//职业相关
	//统一管理职业
	lib.ql_careerMap = new Map([
		["suwei", "宿卫"],
		["qingrui", "轻锐"],
		["yuanji", "远击"],
		["goushu", "构术"],
		["zhanlue", "战略"]
	]);
	//获取职业
	lib.element.Player.prototype.ql_getCareer = function (translate, sub) {
		const career = get.character(sub ? this.name2 : this.name)?.career;
		if (!career || !lib.ql_careerMap.has(career)) {
			return null;
		}
		return translate ? lib.ql_careerMap.get(career) : career;
	}
	//五花米线自定义召唤事件
	lib.element.Player.prototype.ql_addPlayer = function (target, character, character2, isNext, config = {}) {
		const next = game.createEvent("addPlayer");
		next.player = this;
		next.target = target;
		next.rawPairs = [character, character2];
		next.isNext = isNext;
		config.source ??= this;
		config.sourceSkill ??= get.sourceSkillFor(get.event().name);
		config.dieRemove ??= true;
		config.startCards ??= 4;
		config.noCheckResult ??= false;
		for (const i in config) {
			next[i] = config[i];
		}
		next.setContent("ql_addPlayer");
		return next;
	}
	lib.element.content.ql_addPlayer = async function(event, trigger, player) {
		const result = {};
		event.result = result;
		const { source, sourceSkill, target, rawPairs, isNext, animate, isControl, dieRemove, startCards, identity, noCheckResult, callback } = event;
		const newPlayer = await game.addPlayerOL(target, ...rawPairs, isNext, { source, animate });
		result.target = newPlayer;

		if (isControl) {
			game.addGlobalSkill("autoswap");
			if (get.itemtype(isControl) == "player") {
				newPlayer._trueMe = isControl;
			} else {
				newPlayer._trueMe = source || player;
			}
		}
		if (dieRemove) {
			newPlayer.addSkill("ql_dieRemove");
		}
		const cards = get.cards(startCards, true);
		newPlayer.directgain(cards);
		newPlayer._start_cards = cards;
		game.broadcastAll((player, target, source, sourceSkill, identity, noCheckResult) => {
			target._sourceSkill = sourceSkill;
			if (!identity) {
				identity = (target.identity = (identity => {
					switch (identity) {
						case "zhu":
						case "mingzhong":
							return "zhong";
						case "zhu_false":
							return "zhong_false";
						case "bZhu":
							return "bZhong";
						case "rZhu":
							return "rZhong";
						default:
							return identity || "ql_fellow";
					}
				})(source.identity));
			} else {
				target.identity = identity;
			}
			if (!lib.translate[identity]) {
				lib.translate[identity] = "从";
			}
			target.setIdentity();
			if (typeof source.ai?.shown === "number" && target.ai) {
				target.ai.shown = source.ai.shown;
			}
			if (typeof source.side == "boolean") {
				target.side = source.side;
				/*target.node.identity.firstChild.innerHTML = player.node.identity.firstChild.innerHTML;*/
				target.node.identity.dataset.color = source.node.identity.dataset.color;
			}
			if (noCheckResult) {
				target._noCheckResult = true;
			}
			if (_status.ql_addPlayer) {
				return;
			}
			_status.ql_addPlayer = true;
			//检测游戏胜负
			if (typeof game.checkResult === "function") {
				const origin_checkResult = game.checkResult;
				game.checkResult = function () {
					const player = game.me._trueMe || game.me;
					if (game.players.every(i => i["_source"] == player || i == player)) {
						game.over(true);
					} else if (get.mode() == "single") {
						if (!game.players.some(i => (i["_source"] == player && !i._noCheckResult) || i == player)) {
							game.over(false);
						}
						return;
					}
					return origin_checkResult.apply(this, arguments);
				};
			}
			if (typeof game.checkOnlineResult === "function") {
				const origin_checkOnlineResult = game.checkOnlineResult;
				game.checkOnlineResult = function (player) {
					if (player._noCheckResult) {
						return false;
					}
					if (game.players.every(i => i["_source"] == player || i == player)) {
						game.over(true);
					} else if (get.mode() == "single") {
						return false;
					}
					return origin_checkOnlineResult.apply(this, arguments);
				};
			}
			//敌友判定
			//实际上只是友方，敌方不用写
			if (typeof lib.element.player.getFriends === "function") {
				const origin_getFriends = lib.element.player.getFriends;
				const getFriends = function (func, includeDie) {
					const player = this;
					return [...origin_getFriends.apply(this, arguments), ...game[includeDie ? "filterPlayer2" : "filterPlayer"](target => (target["_source"] || target) === (player["_source"] || player))]
						.filter(i => i !== player || func === true)
						.unique()
						.sortBySeat(player);
				};
				lib.element.player.getFriends = getFriends;
				[...game.players, ...game.dead].forEach(i => (i.getFriends = getFriends));
			}
			if (typeof lib.element.player.isFriendOf === "function") {
				const origin_isFriendOf = lib.element.player.isFriendOf;
				const isFriendOf = function (player) {
					if ((this["_source"] || this) === (player["_source"] || player)) {
						return true;
					}
					return origin_isFriendOf.apply(this, arguments);
				};
				lib.element.player.isFriendOf = isFriendOf;
				[...game.players, ...game.dead].forEach(i => (i.isFriendOf = isFriendOf));
			}
			if (typeof lib.element.player.getEnemies === "function") {
				const origin_getEnemies = lib.element.player.getEnemies;
				const getEnemies = function (func, includeDie) {
					if (this["_source"]) {
						return this["_source"].getEnemies(func, includeDie);
					} else {
						const player = this;
						return [
							...origin_getEnemies.apply(this, arguments),
							...game[includeDie ? "filterPlayer2" : "filterPlayer"](target => {
								return origin_getEnemies.apply(this, arguments).includes(target["_source"] || target);
							}),
						]
							.filter(i => player != (i["_source"] || i))
							.unique()
							.sortBySeat(player);
					}
				};
				lib.element.player.getEnemies = getEnemies;
				[...game.players, ...game.dead].forEach(i => (i.getEnemies = getEnemies));
			}
		}, player, newPlayer, source, sourceSkill, identity, noCheckResult);
		if (callback) {
			await callback(event, newPlayer);
		}
	};
	//移除角色
	lib.element.Player.prototype.ql_removePlayer = function(target, config = {}) {
		const next = game.createEvent("removePlayer");
		next.player = this;
		next.forceDie = true;
		next.forceOut = true;
		next.target = target || this;
		config.source ??= this;
		for (const i in config) {
			next[i] = config[i];
		}
		next.setContent("ql_removePlayer");
		return next;
	}
	lib.element.content.ql_removePlayer = async function(event, trigger, player) {
		const { target, source, animate, callback } = event;
		await game.removePlayerOL(target, { animate });
		if (callback) {
			await callback(event, newPlayer);
		}
	}
	lib.element.Player.prototype.ql_chooseMultiPlayerCard = function (config) {
        const next = game.createEvent('ql_chooseMultiPlayerCard');
        next.player = this;
        
        // 默认值
        next.players = game.players.slice(0);
        next.position = 'h';
        next.visible = false;
        next.prompt = '选择任意名角色的牌';
        next.filterCard = lib.filter.all;
        next.filterOk = null;
        next.force = false;
        next.ai = null;
        next.selectCardPerOwner = undefined;
        next.selectCard = undefined;
        
        // 如果传了 config 对象，预先填充
        if (config) {
            if (config.players !== undefined) {
                next.players = Array.isArray(config.players) ? config.players.slice(0) : [config.players];
            }
            if (config.position) next.position = config.position;
            if (config.visible === 'visible') next.visible = true;
            if (config.prompt) next.prompt = config.prompt;
            if (config.filterCard) next.filterCard = config.filterCard;
            if (config.filterOk) next.filterOk = config.filterOk;
            if (config.force) next.force = config.force;
            if (config.ai) next.ai = config.ai;
            if (config.selectCardPerOwner !== undefined) {
                next.selectCardPerOwner = config.selectCardPerOwner;
                next.selectCard = null;
            } else if (config.selectCard !== undefined) {
                next.selectCard = config.selectCard;
            }
        }
        
        next.setContent(lib.element.content.ql_chooseMultiPlayerCard);
        return next;
    };
    //选择任意名角色的牌
    lib.element.content.ql_chooseMultiPlayerCard = async function (event, trigger, player) {
        // 从事件本身读取所有配置（支持 .set() 覆盖）
        let players = event.players;
        if (!players || (Array.isArray(players) && players.length === 0)) {
            console.error('chooseMultiPlayerCard: players 未设置或为空');
            event.result = { bool: false };
            return;
        }
        players = Array.isArray(players) ? players : [players];
        const positions = event.position || 'h';
        const visible = event.visible;
        const prompt = event.prompt || '选择牌';
        const filterCard = event.filterCard || lib.filter.all;
        const force = event.force || false;
        const ai = event.ai || null;
        const perOwnerCfg = event.selectCardPerOwner;
        const totalCfg = event.selectCard;
    
        const getMaxPerOwner = (owner) => {
            if (perOwnerCfg === null || perOwnerCfg === undefined) return Infinity;
            if (typeof perOwnerCfg === 'function') return perOwnerCfg(owner);
            if (Array.isArray(perOwnerCfg)) return perOwnerCfg[1];
            return perOwnerCfg;
        };
        const getMinPerOwner = (owner) => {
            if (perOwnerCfg === null || perOwnerCfg === undefined) return 0;
            if (typeof perOwnerCfg === 'function') return 0;
            if (Array.isArray(perOwnerCfg)) return perOwnerCfg[0];
            return perOwnerCfg;
        };
    
        // 收集所有符合条件的牌
        const cardsWithOwner = [];
        for (const target of players) {
            for (const pos of positions) {
                const cards = target.getCards(pos, filterCard);
                for (const card of cards) {
                    cardsWithOwner.push({ card, owner: target, pos });
                }
            }
        }
        if (cardsWithOwner.length === 0) {
            event.result = { bool: false, cards: [], owners: [], targets: players };
            return;
        }
    
        // 分组
        const ownerMap = new Map();
        for (const item of cardsWithOwner) {
            if (!ownerMap.has(item.owner)) ownerMap.set(item.owner, []);
            ownerMap.get(item.owner).push({ card: item.card, pos: item.pos });
        }
        const ownerOrder = [...ownerMap.keys()];
    
        // 自动全选（牌数 < 最低要求）
        const autoCards = [], autoOwners = [];
        const autoOwnerIds = new Set();
        for (const owner of ownerOrder) {
            const items = ownerMap.get(owner);
            const cards = items.map(i => i.card);
            const min = getMinPerOwner(owner);
            if (cards.length > 0 && cards.length < min) {
                for (const card of cards) {
                    autoCards.push(card);
                    autoOwners.push(owner);
                }
                autoOwnerIds.add(owner.playerid);
            }
        }
    
        // 移除自动选过的
        for (let i = cardsWithOwner.length - 1; i >= 0; i--) {
            if (autoOwnerIds.has(cardsWithOwner[i].owner.playerid)) cardsWithOwner.splice(i, 1);
        }
        for (const id of autoOwnerIds) {
            const o = ownerOrder.find(x => x.playerid === id);
            if (o) ownerMap.delete(o);
        }
        const remainOwners = ownerOrder.filter(o => !autoOwnerIds.has(o.playerid));
    
        // 无剩余牌 → 直接返回
        if (cardsWithOwner.length === 0) {
            event.result = { bool: true, cards: autoCards, owners: autoOwners, targets: players };
            return;
        }
    
        // 计算选择范围
        const autoCnt = autoCards.length;
        let selectBtn;
        if (totalCfg) {
            const min = Math.max(0, totalCfg[0] - autoCnt);
            const max = Math.max(0, totalCfg[1] - autoCnt);
            selectBtn = [min, max];
        } else {
            let sumMin = 0, sumMax = 0;
            for (const o of remainOwners) {
                sumMin += getMinPerOwner(o);
                sumMax += Math.min(getMaxPerOwner(o), ownerMap.get(o).length);
            }
            selectBtn = [sumMin, sumMax];
        }
    
        // 构建对话框
        //（暂时分开吧，如果框太高不方便再改成放一起）
        const dialog = ui.create.dialog(prompt);
        for (const owner of remainOwners) {
            const items = ownerMap.get(owner);
            // 手牌
            const hCards = items.filter(i => i.pos === 'h').map(i => i.card);
            if (hCards.length) {
                dialog.add(`<div class="text center">${get.translation(owner)} 手牌</div>`);
                if (visible) dialog.add(hCards);
                else dialog.add([hCards, 'blank']);
            }
            // 装备
            const eCards = items.filter(i => i.pos === 'e').map(i => i.card);
            if (eCards.length) {
                dialog.add(`<div class="text center">${get.translation(owner)} 装备</div>`);
                dialog.add(eCards); // 强制明置
            }
            // 判定
            const jCards = items.filter(i => i.pos === 'j').map(i => i.card);
            if (jCards.length) {
                dialog.add(`<div class="text center">${get.translation(owner)} 判定</div>`);
                dialog.add(jCards); // 强制明置
            }
        }
        
        // 计数器
        const ownerSelectedCount = new Map();
        const updateCount = () => {
            ownerSelectedCount.clear();
            for (const btn of ui.selected.buttons) {
                const link = btn.link;
                const item = cardsWithOwner.find(i => i.card === link);
                if (item) {
                    ownerSelectedCount.set(item.owner, (ownerSelectedCount.get(item.owner) || 0) + 1);
                }
            }
        };
    
        // 按钮过滤
        const filterButton = (button) => {
            const card = button.link;
            const item = cardsWithOwner.find(i => i.card === card);
            if (!item) return false;
            const cur = ownerSelectedCount.get(item.owner) || 0;
            if (perOwnerCfg !== undefined && cur >= getMaxPerOwner(item.owner)) return false;
            if (selectBtn[1] !== Infinity && ui.selected.buttons.length >= selectBtn[1]) return false;
            return true;
        };
    
        // 确认条件
        const filterOk = () => {
            if (perOwnerCfg !== undefined) {
                for (const o of remainOwners) {
                    if ((ownerSelectedCount.get(o) || 0) < getMinPerOwner(o)) return false;
                }
            }
            if (ui.selected.buttons.length < selectBtn[0]) return false;
            if (event.filterOk && !event.filterOk()) return false;
            return true;
        };
    
        // 选牌
        const chooseResult = await player.chooseButton(selectBtn, force, dialog)
            .set('filterButton', filterButton)
            .set('filterOk', filterOk)
            .set('ai', ai)
            .set('custom', {
                add: { button: updateCount },
                remove: { button: updateCount },
            })
            .forResult();
    
        // 合并结果
        if (chooseResult.bool && chooseResult.links) {
            const finalCards = [...autoCards];
            const finalOwners = [...autoOwners];
            for (const card of chooseResult.links) {
                const item = cardsWithOwner.find(i => i.card === card);
                if (item) {
                    finalCards.push(card);
                    finalOwners.push(item.owner);
                }
            }
            event.result = { bool: true, cards: finalCards, owners: finalOwners, targets: players };
        } else if (autoCards.length > 0 && (!force || selectBtn[0] === 0)) {
            event.result = { bool: true, cards: autoCards, owners: autoOwners, targets: players };
        } else {
            event.result = { bool: false };
        }
    };
    //可重复选择角色
    lib.element.Player.prototype.ql_chooseMultiTarget = function (config) {
        const next = game.createEvent('ql_chooseMultiTarget');
        next.player = this;
    
        // 默认值
        next.filterTarget = lib.filter.all;
        next.prompt = '请选择角色';
        next.ai = null;
        next.totalCount = 1;          // 内部会转为 [min, max] 数组
        next.maxNum = undefined;      // 未设置时默认为总次数的最大值
        next.filterOk = () => true;
        next.force = false;
    
        // 如果传入了 config 对象，则用其值覆盖默认值
        if (config) {
            if (config.filterTarget !== undefined) next.filterTarget = config.filterTarget;
            if (config.prompt !== undefined) next.prompt = config.prompt;
            if (config.ai !== undefined) next.ai = config.ai;
            if (config.totalCount !== undefined) next.totalCount = config.totalCount;
            if (config.maxNum !== undefined) next.maxNum = config.maxNum;
            if (config.filterOk !== undefined) next.filterOk = config.filterOk;
            if (config.force !== undefined) next.force = config.force;
        }
    
        next.setContent(lib.element.content.ql_chooseMultiTarget);
        return next;
    };
    
    // 对应的 content 函数
    lib.element.content.ql_chooseMultiTarget = async function (event, trigger, player) {
        const filter = event.filterTarget || lib.filter.all;
        const promptText = event.prompt || '请选择角色';
        const aiFunc = event.ai || null;
        let total = event.totalCount;
        if (total === undefined) total = 1;
        const range = typeof total === 'number' ? [total, total] : (get.itemtype(total) === 'select' ? total : [1, 1]);
        const perMax = event.maxNum || range[1];
        const okCheck = event.filterOk || (() => true);
        const isForced = event.force || false;
    
        if (range[0] <= 0) {
            event.result = { bool: false };
            game.resume();
            return;
        }
    
        if (!event.isMine()) {
            event.result = 'ai';
            return;
        }
    
        const allTargets = game.players.concat(game.dead);
        const selectableTargets = allTargets.filter(t => filter(null, player, t));
        if (!selectableTargets.length) {
            event.result = { bool: false };
            game.resume();
            return;
        }
    
        const targetMap = new Map();
        let currentTotal = 0;
        const min = range[0];
        const max = range[1];
    
        const dialog = ui.create.dialog(promptText, 'hidden');
        dialog.forcebutton = true;
        dialog.classList.add('noupdate');
        dialog.open();
        event.dialog = dialog;
        event._selectableTargets = selectableTargets;
        event._targetMap = targetMap;
        event._currentTotal = 0;
        event._min = min;
        event._max = max;
        event._perMax = perMax;
        event._okCheck = okCheck;
        event._isForced = isForced;
    
        const hint = ui.create.div('.text.center', '');
        dialog.content.appendChild(hint);
        event._hint = hint;
    
        selectableTargets.forEach(t => t.classList.add('selectable'));
    
        // 根据 force 决定显示“确定”还是“确定+取消”
        ui.create.confirm(isForced ? 'o' : 'oc');
        const confirmBtn = ui.confirm;
    
        const updateUI = () => {
            const remain = max - currentTotal;
            hint.innerHTML = `共需选择 ${min}~${max} 次（每名角色最多 ${perMax} 次）<br>已选 ${currentTotal} 次，还可选 ${remain} 次`;
            const canConfirm = currentTotal >= min && okCheck(event);
            if (canConfirm) {
                confirmBtn.classList.remove('disabled');
            } else {
                confirmBtn.classList.add('disabled');
            }
        };
    
        const cleanup = () => {
            selectableTargets.forEach(t => t.classList.remove('selectable'));
            selectableTargets.forEach(t => t.unprompt());
            if (event.dialog) event.dialog.close();
            if (event.controls) event.controls.forEach(i => i.close());
            game.uncheck();
            game.stopCountChoose();
        };
    
        const finish = (bool) => {
            if (bool) {
                const targets = [];
                targetMap.forEach((count, t) => {
                    for (let i = 0; i < count; i++) targets.push(t);
                });
                event.result = { bool: true, targets, map: new Map(targetMap) };
            } else {
                event.result = { bool: false };
            }
            cleanup();
            game.resume();
        };
    
        // “清除选择”按钮
        const clearControl = ui.create.control([
            link => {
                targetMap.clear();
                currentTotal = 0;
                selectableTargets.forEach(t => t.unprompt());
                updateUI();
            },
        ].concat(['清除选择', 'stayleft']));
        event.controls = [clearControl];
    
        updateUI();
    
        // 重写目标点击：支持重复选择
        event.custom = event.custom || { add: {}, replace: {} };
        event.custom.replace.target = function (target, e) {
            if (!selectableTargets.includes(target)) return;
            const cur = targetMap.get(target) || 0;
            if (cur >= perMax) return;
            if (currentTotal >= max) return;
    
            targetMap.set(target, cur + 1);
            currentTotal++;
            target.unprompt();
            target.prompt("×" + (cur + 1), 'orange');
            updateUI();
        };
    
        // 覆盖原生确认/取消按钮的行为
        event.custom.replace.confirm = function(bool) {
            if (bool) {
                if (currentTotal < min || !okCheck(event)) return;
                finish(true);
            } else {
                if (!isForced) finish(false);
            }
        };
    
        game.pause();
        game.countChoose();
        event.choosing = true;
    };
	// 假设你的扩展配置是 lib.config.extension_五花米线
	// 那么 config 就是那个对象，你可以用 config.enable 判断
	if (config && config.enable) {
		//导入武将包
		let result = await import(`../character_qlwh/index.js`).catch(e => alert(`在导入武将包“五花米线”时出现错误:\n${e.stack}`));
		let characterPack = result.characterPack;
		if (characterPack) {
			game.import("character", () => characterPack);
		}
		let abc = function () {
			window.whmx(lib, game, ui, get, ai, _status);
		};
		let path = lib.assetURL + "extension/" + "五花米线" + "/";
		let whmx = {};
		//武将
		if (!whmx.character) whmx.character = [];
		//卡牌
		if (!whmx.card) whmx.card = [];
		//自定义函数
		//导入自定义函数，覆盖本体函数
		if (!whmx.func) whmx.func = [];
		whmx.func.add("trigger");
		lib.init.css(path, 'extension');
		//循环导入
		for (let id in whmx) {
			let list = whmx[id];
			if (list && Array.isArray(list)) {
				for (let idx of list) {
					if (typeof idx === "string") lib.init.js(path + id, idx, abc);
				};
			};
		};

		// 注册武将包
		/*if (!lib.config.all.characters.includes("qlwh")) {
			lib.config.all.characters.push("qlwh");
		}*/
		if (!lib.config.characters.includes("qlwh")) {
			lib.config.characters.push("qlwh");
		}
		//修饰扩展名
		lib.translate["qlwh_character_config"] = "<span style='color:#FF00FF;font-weight:bold'>五花米线</span>";
		lib.translate["mfyy_character_config"] = "<span style='color:#5C6D7E;font-weight:bold'>墨风雅韵</span>";

		//导入卡牌包
		/*game.import('card', (lib, game, ui, get, ai, _status) => {
			var qlwh_card = {
				name: "qlwh_card",
				connect: true,
				//加入卡牌
				card: {
					
				},
				//卡牌的技能
				skill: {

				},
				//卡牌翻译
				translate: {
					qlwh_card:'五花米线',
					
				},
				//卡牌加入牌堆的信息
				list: [
					["diamond", 12, "qlwh_fangtian"],
				]
			};
			for (var cardName in qlwh_card.card) {
			  var card = qlwh_card.card[cardName];
			  //预留的素材接口（）
			  if (card.fullskin) {
				card.image = `ext:五花米线/image/card/qlwh/${cardName}.png`;
			  }
			  if (card.audio === true) {
				card.audio = `ext:${extname}`;
			  }
			}
			return qlwh_card;
		});*/
	}
}
