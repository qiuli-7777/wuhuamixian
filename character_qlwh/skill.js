import { lib, game, ui, get, ai, _status } from "../../../noname.js";

/** @type { importCharacterConfig['skill'] } */
const skills = {
	//断臂维纳斯
	ql_yongtan: {
		mark: true,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage, player, skill) {
				if (!storage) {
					return "出牌阶段，你可以弃置两张牌令一名角色造成伤害+1目改为雷电伤害至其回合结束";
				}
				return "出牌阶段，你可以与一名角色拼点，赢得角色回复一点体力或获得一点护甲，然后你可以获得体力值不小于你的角色区域内各一张牌";
			},
		},
		enable: "phaseUse",
		filterTarget(card, player, target) {
			const bool = player.storage.ql_yongtan;
			return !bool ? true : player.canCompare(target);
		},
		selectTarget: 1,
		filterCard(card, player) {
			const bool = player.storage.ql_yongtan;
			return !bool ? lib.filter.cardDiscardable(card, player, "ql_yongtan") : false;
		},
		selectCard() {
			return !get.player().storage.ql_yongtan ? 2 : -1;
		},
		check(card) {
			return 6 - get.value(card);
		},
		async content(event, trigger, player) {
			const bool = player.storage[event.name];
			player.changeZhuanhuanji(event.name);
			const { target } = event;
			if (!bool) {
				target.addTempSkill(event.name + "_effect", { player: "phaseAfter" });
			} else {
				const result = await player.chooseToCompare(target).forResult();
				const { winner } = result;
				if (winner?.isIn()) {
					let result;
					if (!winner.isDamaged()) {
						result = { index: 1 };
					} else {
						result = await winner
							.chooseControl({
								choiceList: [
									`回复一点体力`,
									"获得一点护甲",
								],
								choice: get.recoverEffect(winner, winner, winner) > 0 ? 0 : 1,
							})
							.forResult();
					}
					if (result.index == 0) {
						await winner.recover();
					} else {
						await winner.changeHujia(1);
					}
				}
				const targets = game.filterPlayer(target => target.getHp() >= player.getHp());
				if (targets?.length) {
					player.line(targets, "yellow");
					await game.doAsyncInOrder(targets, async target => player.gainPlayerCard({ target, position: "hej" }));
				}
			}
		},
		ai: {
			order: 5,
			reuslt: {
				target(player, target) {
					const bool = player.storage.ql_yongtan;
					if (!bool) {
						if (target.hasSkill("ql_yongtan_effect")) {
							return 0;
						}
						return 1 + (player == target ? 1 : 0);
					} else {
						const num = target.countCards("h");
						if (num == 1) {
							return -1;
						}
						if (num == 2) {
							return -0.7;
						}
						return -0.5;
					}
				},
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: {
					source: "damageBegin1",
				},
				forced: true,
				mark: true,
				async content(event, trigger, player) {
					trigger.num++;
					game.setNature(trigger, "thunder");
				},
				marktext: "⚡",
				intro: {
					content: "造成的伤害+1且改为雷属性",
				},
			},
		}
	},
	ql_daolie: {
		forced: true,
		trigger: {
			player: "logSkillBegin",
		},
		filter(event, player) {
			const skill = get.sourceSkillFor(event);
			if (skill != "ql_tongxing") {
				return false;
			}
			console.log(event);
			const index = player.getAllHistory("useSkill", evt => get.sourceSkillFor(evt) == skill).map(evt => evt.event).indexOf(event.log_event);
			return index >= 0 && (index + 1) % 3 == 0;
		},
		async content(event, trigger, player) {
			player.addSkill(event.name + "_effect");
		},
		subSkill: {
			effect: {
				mark: true,
				intro: {
					content: "你的下一张【杀】伤害*3且不可被响应",
				},
				init(player, skill) {
					player.addTip(skill, "倒列 暴击强命");
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					return event.card.name == "sha";
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					trigger.baseDamage *= 3;
					trigger.directHit.addArray(game.players);
				},
			}
		}
	},
	ql_tongxing: {
		forced: true,
		trigger: {
			global: "damageEnd",
			player: "damageBegin4",
		},
		filter(event, player) {
			return event.hasNature("thunder");
		},
		async content(event, trigger, player) {
			if (event.triggername == "damageEnd") {
				await player.draw(trigger.num);
			} else {
				trigger.cancel();
				await player.draw(trigger.num);
			}
		},
		intro: {
			content: "mark",
		},
		group: ["ql_tongxing_addMark", "ql_tongxing_draw"],
		subSkill: {
			addMark: {
				forced: true,
				trigger: {
					global: "phaseBefore",
					player: ["enterGame", "recoverAfter", "changeHujiaAfter"],
				},
				getIndex(event, player) {
					if (["recover", "changeHujia"].includes(event.name)) {
						return event.num;
					}
					return 1;
				},
				async content(event, trigger, player) {
					player.addMark("ql_tongxing");
				}
			},
			draw: {
				trigger: {
					global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				getIndex(event, player) {
					const evt = event.relatedEvent || event.getParent();
					if (["useCard", "respond"].includes(evt?.name)) {
						return [];
					}
					return game.filterPlayer(target => {
						const evtx = event?.getl(target);
						return evtx?.cards2?.length;
					}).sortBySeat();
				},
				filter(event, player, name, target) {
					return target?.isIn() && player.hasMark("ql_tongxing");
				},
				logTarget(event, player, name, target) {
					return target;
				},
				check(event, player, name, target) {
					return get.attitude(player, target) > 0;
				},
				prompt2(event, player) {
					return `移去一枚“同形”令其摸两张牌且使用的下一张牌无次数限制`;
				},
				async content(event, trigger, player) {
					player.removeMark("ql_tongxing");
					const { targets: [target] } = event;
					await target.draw(2);
					target.addSkill("ql_tongxing_nocount");
				}
			},
			nocount: {
				mod: {
					cardUsable(card, player) {
						return Infinity;
					}
				},
				/*mark: true,
				intro: {
					content: "使用的下一张牌无次数限制",
				},*/
				init(player, skill) {
					player.addTip(skill, "同形 无次数限制");
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				charlotte: true,
				forced: true,
				popup: false,
				firstDo: true,
				trigger: { player: "useCard1" },
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card, name = trigger.card.name;
						if (typeof stat[name] == "number") {
							stat[name]--;
						}
						game.log(trigger.card, "不计入次数");
					}
				}
			},
		},
	},
	//天王石刻
	_startGame_tianwang: {
		trigger: {
			global: "gameStart",
		},
		filter(event, player) {
			return player.name == "ql_tianwang";
		},
		charlotte: true,
		firstDo: true,
		//silent: true,
		async cost(event, trigger, player) {
			game.log(player.style.zIndex);
			game.broadcastAll(player => {
				ui.backgroundMusic.pause();
				game.pause();
				const dialog = document.createElement("video");
				dialog.style.backgroundColor = "black";
				dialog.style.position = "fixed";
				dialog.style.top = "0";
				dialog.style.left = "0";
				dialog.style.width = "100%";
				dialog.style.height = "100%";
				dialog.style.zIndex = "1001";
				dialog.muted = false;
				dialog.setAttribute("src", `${lib.assetURL}extension/五花米线/video/天王石刻.mp4`);
				dialog.setAttribute("autoplay", "autoplay");
				document.body.appendChild(dialog);
				setTimeout(() => {
					document.body.removeChild(dialog);
					game.resume();
				}, 28000)
			}, player)
		},
	},
	ql_shenhu: {
		intro: {
			content: "#层神力",
		},
		fixed: true,
		superCharlotte: true,
		charlotte: true,
		forced: true,
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			player: ["enterGame", "dieBegin", "loseHpBefore", "damageBegin4"],
			global: ["phaseBefore", "useSkill", "logSkillBegin", "roundStart", "damageCancelled", "damageZero", "damageAfter"],
		},
		filter(event, player, name) {
			if (name == "enterGame" || name == "phaseBefore") {
				return event.name != "phase" || game.phaseNumber == 0;
			}
			if (event.name == "damage" && name != "damageBegin4") {
				if (name == "damageCancelled") {
					return true;
				}
				for (var i of event.change_history) {
					if (i < 0) {
						return true;
					}
				}
				return false;
			}
			if (name.includes("Skill")) {
				if (["global", "equip"].includes(event.type) || event.player == player) {
					return false;
				}
				let skill = get.sourceSkillFor(event);
				let info = get.info(skill);
				if (!skill || !info || info.equipSkill) {
					return false;
				}
				const skills = game.expandSkills([skill], true);
				return skills.some(i => lib.skill[i]?.content?.toString()?.includes("trigger.cancel") || lib.skill[i]?.content?.toString()?.includes(".skip") || lib.skill[i]?.content?.toString()?.includes("trigger.num =") || lib.skill[i]?.content?.toString()?.includes("all_excluded") || lib.skill[i]?.content?.toString()?.includes(".goto"));
			}
			return true;
		},
		async content(event, trigger, player) {
			if ((trigger.name == "die" && (player.hp > 0 || player.countMark(event.name))) || trigger.name == "loseHp") {
				if (player.isDying()) {
					player.hp = 5;
					player.update();
				}
				trigger.cancel();
				return;
			}
			if (event.triggername.includes("Skill")) {
				let skill = get.sourceSkillFor(trigger);
				const skills = game.expandSkills([skill], true);
				skills.forEach(skill => {
					for (const i in lib.hook) {
						const id = parseInt(i.split("_")[0]);
						if (id == trigger.player.playerid) {
							lib.hook[i].remove(skill);
						}
					}
				})
				game.log(trigger.player, "的", `#g【${get.translation(skill)}】`, "被神力碾碎了");
				return;
			}
			if (event.triggername == "damageBegin4") {
				let num = 0;
				const history = game.getAllGlobalHistory();
				for (let i = history.length - 1; i >= 0; i--) {
					const evt = history[i]["everything"];
					for (let j = evt.length - 1; j >= 0; j--) {
						if (evt[j].name == "damage" && evt[j].player == player) num++;
					}
					if (history[i].isRound) break;
				}
				if (num == 1) {
					player.insertPhase();
				}
				await player.draw(3, "nodelay");
				if (trigger?.source?.isIn() && trigger?.source != player) {
					player.showHandcards();
					const num = player.getCards("h", card => get.type(card) == "basic").map(card => card.name).unique().length;
					trigger.source.damage(num);
				}
				const result = await player.judge().forResult();
				await player.gain(result.card, "gain2");
				if (result.number != (get.number(trigger?.card) || 0)) {
					trigger.cancel();
				}
				return;
			}
			game.broadcastAll((bg, bgm) => {
				if (_status.tempBackground != bg) {
					_status.tempBackground = bg;
					game.updateBackground();
				}
				if (_status.tempMusic != bgm) {
					_status.tempMusic = bgm;
					game.playBackgroundMusic();

				}
			}, `ext:五花米线/skin/background/天王石刻.png`, `ext:五花米线/audio/background/天王石刻.mp3`)
			if (!player.isDisabledJudge()) {
				await player.disableJudge();
			}
			if (player.countMark(event.name) < 6) {
				let num = event.triggername.includes("damage") ? 1 : 3;
				player.addMark(event.name, Math.min(num, 6 - player.countMark(event.name)), true);
			}
		},
	},
	ql_zhensui: {
		fixed: true,
		superCharlotte: true,
		charlotte: true,
		firstDo: true,
		audio: "ext:五花米线/audio/skill:1",
		group: ["ql_zhensui_basic"],
		global: "ql_zhensui_target",
		mod: {
			playerEnabled(card, player, target) {
				if (card.name == "sha") {
					return true;
				}
			},
			cardEnabled() {
				return true;
			},
			cardRespondable() {
				return true;
			},
			cardSavable(card) {
				if (card.name == "tao") {
					return true;
				}
			},
		},
		trigger: {
			player: ["phaseUseBegin", "phaseUseEnd"],
		},
		filter(event, player, name) {
			if (name == "phaseUseBegin") {
				return player.countMark("ql_shenhu") > 0;
			}
			return true;
		},
		async cost(event, trigger, player) {
			if (event.triggername == "phaseUseBegin") {
				event.result = await player.chooseBool(`移去全部神力`).forResult();
				return;
			}
			event.result = await player.chooseCardTarget()
				.set("filterCard", (card) => true)
				.set("selectCard", [1, Infinity])
				.set("filterTarget", (card, player, target) => true)
				.set("selectTarget", [1, Infinity])
				.set("filterOk", () => {
					return ui.selected.cards.length == ui.selected.targets.length;
				})
				.set("position", "he")
				.set("targetprompt", () => {
					return ["获得", get.translation(ui.selected.cards[ui.selected.targets.length - 1])].join("<br>");
				})
				.forResult();
		},
		async content(event, trigger, player) {
			if (event.triggername == "phaseUseBegin") {
				if (player.countMark("ql_shenhu") < 6) {
					player.addMark("ql_shenhu", Math.min(2, 6 - player.countMark("ql_shenhu")), true);
				}
				const num = player.countMark("ql_shenhu");
				player.clearMark("ql_shenhu");
				await player.gainMaxHp(num);
				await player.recover(num);
				await player.draw(num);
				player.storage.ql_zhensui_effect = num;
				player.addTempSkill(event.name + "_effect");
				return;
			}
			const { cards, targets, name } = event;
			for (let i = 0; i < cards.length; i++) {
				await player.give(cards[i], targets[i]);
				player.addTempSkill(name + "_cover", { player: "phaseUseBegin" });
				player.markAuto(name + "_cover", targets[i]);
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				forced: true,
				audio: "ext:五花米线/audio/skill:2",
				mod: {
					targetInRange(card, player) {
						return true;
					},
					cardUsable(card, player) {
						return true;
					},
					selectTarget(card, player, range) {
						if (card.name == "sha" && range[1] != -1) {
							range[1] = Infinity;
						}
					},
				},
				trigger: {
					player: "useCard",
				},
				filter(event, player) {
					return event.card.name == "sha" && player.storage.ql_zhensui_effect > 0;
				},
				async content(event, trigger, player) {
					const { targets } = trigger;
					const targetIds = targets.map(t => t.playerid);
					game.broadcastAll((playerId, targetIdList) => {
						const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
						if (isMobile && navigator.vibrate) {
							navigator.vibrate([200, 100, 200, 100, 200]); // 震动三次
						}
						// ----- 1. 获取技能使用者的位置 -----
						let sourcePlayer = null;
						if (_status.connectMode) {
							sourcePlayer = lib.playerOL[playerId];
						} else {
							sourcePlayer = game.players.find(p => p.playerid === playerId) || game.dead.find(p => p.playerid === playerId);
						}
						if (!sourcePlayer) return;
						const srcRect = sourcePlayer.getBoundingClientRect();
						const startX = srcRect.left + srcRect.width / 2;
						const startY = srcRect.top + srcRect.height / 2;

						// ----- 2. 获取所有目标的位置（静态）-----
						const targetsPos = [];
						targetIdList.forEach(tid => {
							let tPlayer = null;
							if (_status.connectMode) {
								tPlayer = lib.playerOL[tid];
							} else {
								tPlayer = game.players.find(p => p.playerid === tid) || game.dead.find(p => p.playerid === tid);
							}
							if (tPlayer) {
								const rect = tPlayer.getBoundingClientRect();
								targetsPos.push({
									id: tid,
									x: rect.left + rect.width / 2,
									y: rect.top + rect.height / 2,
								});
							}
						});

						// ----- 3. 智能选择对角方向（飞向远离角色的角落）-----
						const screenCenterX = window.innerWidth / 2;
						const screenCenterY = window.innerHeight / 2;
						let endX, endY;
						if (startX < screenCenterX && startY < screenCenterY) {
							endX = window.innerWidth + 200;
							endY = window.innerHeight + 200;
						} else if (startX >= screenCenterX && startY < screenCenterY) {
							endX = -200;
							endY = window.innerHeight + 200;
						} else if (startX < screenCenterX && startY >= screenCenterY) {
							endX = window.innerWidth + 200;
							endY = -200;
						} else {
							endX = -200;
							endY = -200;
						}

						// ----- 4. 动画参数 -----
						const duration = 1200;               // 飞行时间1.2秒
						const startTime = performance.now();
						const startLongRadius = 20;
						const endLongRadius = 500;           // 最终大小翻倍
						const flatRatio = 0.2;               // 压扁系数
						const holeOffsetRatio = 0.98;        // 挖孔偏移（越接近1越尖）
						const holeRadiusRatio = 0.75;        // 挖孔半径（越小月牙越细）
						const EXPLODE_RADIUS = 200;           // 爆炸判定半径（增大到200px）

						// 爆炸状态
						let explodedSet = new Set();           // 已触发爆炸的目标id

						// ----- 5. 爆炸特效函数（借鉴 boom_yzs 的粒子效果）-----
						function createExplosionAt(x, y) {
							// 创建爆炸容器
							const explosion = document.createElement('div');
							explosion.className = 'explosion-effect';
							Object.assign(explosion.style, {
								position: 'fixed',
								left: `${x}px`,
								top: `${y}px`,
								width: '0px',
								height: '0px',
								zIndex: '1000',
								pointerEvents: 'none',
								transform: 'translate(-50%, -50%)'
							});
							document.body.appendChild(explosion);

							// 创建粒子（参考 boom_yzs 但增大范围和数量）
							const colors = ['#ff0000', '#ff8800', '#ffff00', '#ff6600', '#ff3300'];
							const particleCount = 30;

							for (let i = 0; i < particleCount; i++) {
								const particle = document.createElement('div');
								particle.className = 'explosion-particle';

								// 随机大小（10-40px）
								const size = Math.random() * 30 + 10;
								const color = colors[Math.floor(Math.random() * colors.length)];

								Object.assign(particle.style, {
									position: 'absolute',
									width: `${size}px`,
									height: `${size}px`,
									background: color,
									borderRadius: '50%',
									left: '0',
									top: '0',
									transform: 'translate(-50%, -50%)',
									opacity: '0',
									boxShadow: `0 0 ${size * 0.8}px ${color}`,
									filter: 'blur(2px)'
								});

								explosion.appendChild(particle);

								// 随机方向、距离、持续时间
								const angle = Math.random() * Math.PI * 2;
								const distance = Math.random() * 120 + 50; // 飞散距离增大
								const duration = Math.random() * 400 + 500; // 持续0.5-0.9秒

								const animation = particle.animate([
									{
										opacity: 0,
										transform: 'translate(-50%, -50%) scale(0)'
									},
									{
										opacity: 1,
										transform: 'translate(-50%, -50%) scale(1)',
										offset: 0.2
									},
									{
										opacity: 0.8,
										transform: `translate(${-50 + Math.cos(angle) * distance}%, ${-50 + Math.sin(angle) * distance}%) scale(0.6)`,
										offset: 0.6
									},
									{
										opacity: 0,
										transform: `translate(${-50 + Math.cos(angle) * (distance + 30)}%, ${-50 + Math.sin(angle) * (distance + 30)}%) scale(0)`
									}
								], {
									duration: duration,
									easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
									fill: 'forwards'
								});

								animation.onfinish = () => particle.remove();
							}

							// 添加一个冲击波圆环（类似爆炸光晕）
							const wave = document.createElement('div');
							Object.assign(wave.style, {
								position: 'absolute',
								left: '0',
								top: '0',
								width: '20px',
								height: '20px',
								borderRadius: '50%',
								border: '4px solid #ff8800',
								transform: 'translate(-50%, -50%) scale(0)',
								opacity: '1',
								boxShadow: '0 0 20px rgba(255, 68, 0, 0.8)'
							});
							explosion.appendChild(wave);
							const waveAnim = wave.animate([
								{ transform: 'translate(-50%, -50%) scale(0)', opacity: 1, borderWidth: '6px' },
								{ transform: 'translate(-50%, -50%) scale(4)', opacity: 0, borderWidth: '1px' }
							], { duration: 600, easing: 'ease-out' });
							waveAnim.onfinish = () => wave.remove();

							// 爆炸容器在动画结束后移除
							setTimeout(() => {
								if (explosion.parentNode) explosion.remove();
							}, 1000);
						}

						// ----- 6. 创建全屏Canvas（用于绘制月牙）-----
						const canvas = document.createElement('canvas');
						const ctx = canvas.getContext('2d');
						canvas.style.position = 'fixed';
						canvas.style.top = '0';
						canvas.style.left = '0';
						canvas.style.width = '100%';
						canvas.style.height = '100%';
						canvas.style.pointerEvents = 'none';
						canvas.style.zIndex = '9999';
						document.body.appendChild(canvas);

						const resize = () => {
							canvas.width = window.innerWidth;
							canvas.height = window.innerHeight;
						};
						resize();
						window.addEventListener('resize', resize);

						// ----- 7. 动画主循环（只绘制月牙）-----
						function animate(now) {
							let elapsed = now - startTime;
							let progress = Math.min(1, Math.max(0, elapsed / duration));
							const easeOut = progress * (2 - progress); // 前期变大更快

							// 当前剑气坐标和尺寸
							const curX = startX + (endX - startX) * easeOut;
							const curY = startY + (endY - startY) * easeOut;
							const curLongRadius = startLongRadius + (endLongRadius - startLongRadius) * easeOut;
							const angle = Math.atan2(endY - startY, endX - startX);

							// ----- 爆炸触发检测 -----
							for (let tp of targetsPos) {
								if (!explodedSet.has(tp.id)) {
									const dist = Math.hypot(curX - tp.x, curY - tp.y);
									if (dist < EXPLODE_RADIUS) {
										explodedSet.add(tp.id);
										createExplosionAt(tp.x, tp.y); // 调用粒子爆炸
									}
								}
							}

							// 绘制月牙剑气
							ctx.clearRect(0, 0, canvas.width, canvas.height);
							ctx.save();

							ctx.translate(curX, curY);
							ctx.rotate(angle);
							ctx.scale(flatRatio, 1);
							// 主体（白色半透明）
							ctx.beginPath();
							ctx.arc(0, 0, curLongRadius, 0, Math.PI * 2);
							ctx.fillStyle = `rgba(255, 255, 255, ${0.9 - progress * 0.5})`;
							ctx.fill();
							// 挖孔形成月牙
							ctx.globalCompositeOperation = 'destination-out';
							ctx.beginPath();
							const holeOffsetX = -curLongRadius * holeOffsetRatio;
							const holeOffsetY = 0;
							ctx.arc(holeOffsetX, holeOffsetY, curLongRadius * holeRadiusRatio, 0, Math.PI * 2);
							ctx.fill();
							ctx.globalCompositeOperation = 'source-over';
							// 外发光
							ctx.shadowBlur = 20;
							ctx.shadowColor = 'rgba(200, 220, 255, 0.9)';
							ctx.beginPath();
							ctx.arc(0, 0, curLongRadius * 0.6, 0, Math.PI * 2);
							ctx.fillStyle = `rgba(255, 255, 200, ${0.4 * (1 - progress)})`;
							ctx.fill();
							ctx.shadowBlur = 0;
							ctx.restore();

							if (progress < 1) {
								requestAnimationFrame(animate);
							} else {
								window.removeEventListener('resize', resize);
								canvas.remove();
							}
						}

						requestAnimationFrame(animate);
					}, player.playerid, targetIds);
					const num = player.countCards("h", card => get.type(card) == "basic");
					trigger.directHit.addArray(targets);
					for (let target of targets) {
						await target.randomDiscard({ num: 2, discarder: player, position: "he" });
					}
					trigger.baseDamage += num;
					await player.draw(2);
					trigger.card.storage.ql_zhensui_1 = true;
					player.when({ player: "useCardAfter" })
						.filter(evt => evt?.card?.storage?.ql_zhensui_1 && !player.hasHistory("sourceDamage", evt => evt?.card?.storage?.ql_zhensui_1))
						.step(async (event, trigger, player) => {
							await game.doAsyncInOrder(targets, async current => {
								await current.loseHp(trigger.baseDamage);
							})
						})
					player.storage.ql_zhensui_effect--;
				},
			},
			basic: {
				enable: "chooseToUse",
				filter(event, player) {
					if (!player.countCards("h", card => get.type(card) == "basic")) {
						return false;
					}
					for (let i of lib.inpile) {
						let type = get.type2(i);
						if ((type == "basic" || type == "trick") && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
							return true;
						}
					}
					return false;
				},
				chooseButton: {
					dialog(event, player) {
						let list = [];
						for (var i = 0; i < lib.inpile.length; i++) {
							var name = lib.inpile[i];
							if (name == "sha") {
								if (event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
									list.push(["基本", "", "sha"]);
								}
								for (var nature of lib.inpile_nature) {
									if (event.filterCard(get.autoViewAs({ name, nature }, "unsure"), player, event)) {
										list.push(["基本", "", "sha", nature]);
									}
								}
							} else if (get.type2(name) == "trick" && event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
								list.push(["锦囊", "", name]);
							} else if (get.type(name) == "basic" && event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
								list.push(["基本", "", name]);
							}
						}
						return ui.create.dialog("镇祟", [list, "vcard"]);
					},
					backup(links, player) {
						return {
							links: links,
							filterCard(card, player) {
								return get.type(card) == "basic";
							},
							popname: true,
							check(card) {
								return 8 - get.value(card);
							},
							position: "hse",
							viewAs: { name: links[0][2], nature: links[0][3], storage: { ql_zhensui: true } },
							async precontent(event, trigger, player) {
								player.when({ player: "useCard" })
									.filter(evt => evt?.card?.storage?.ql_zhensui)
									.step(async (event, trigger, player) => {
										trigger.baseDamage++;
									})
							},
						};
					},
					prompt(links, player) {
						return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
					},
				},
				hiddenCard(player, name) {
					if (!lib.inpile.includes(name)) {
						return false;
					}
					var type = get.type2(name);
					return (type == "basic" || type == "trick") && player.countCards("she") > 0;
				},
			},
			cover: {
				charlotte: true,
				intro: {
					content: "#被你援护",
				},
				trigger: {
					global: ["damageBegin4", "phaseEnd", "useCard"],
				},
				frequent(event, player) {
					if (event.name == "useCard") {
						return true;
					}
					return false;
				},
				filter(event, player) {
					if (event.name == "damage" && event.player == player) {
						return false;
					}
					return player.getStorage("ql_zhensui_cover").includes(event.player);
				},
				prompt2(event, player) {
					if (event.name == "damage") {
						return `是否代替${get.translation(event.player)}承受该次伤害`;
					}
					return `是否分配牌堆顶的牌`;
				},
				async content(event, trigger, player) {
					if (trigger.name == "useCard" && player.countMark("ql_shenhu") < 6) {
						player.addMark("ql_shenhu", true);
						return;
					}
					if (trigger.name == "damage") {
						/*trigger.cancel();
						await player.damage(trigger.num, trigger?.source);*/
						trigger.player = player;
						return;
					}
					const result = await player.ql_chooseMultiTarget()
						.set("filterTarget", (card, player, target) => {
							return player.getStorage(event.name).includes(target) || target == player;
						})
						.set("totalCount", [1, 7])
						.forResult();
					if (result.bool) {
						for (let [target, num] of result.map) {
							await target.draw(num);
						}
					}
				},
			},
		},
		target: {
			firstDo: true,
			mod: {
				targetEnabled(card, player, target) {
					return true;
				},
			},
			priority: Infinity,
		},
		priority: Infinity,
	},
	//上阳台帖
	ql_yinjian: {
		trigger: {
			global: ["chooseToRespondBegin", "chooseToUseBegin"],
		},
		forced: true,
		filter(event, player) {
			if (event.responded) {
				return false;
			}
			if (!event.filterCard({ name: "shan", isCard: true }, event.player, event)) {
				return false;
			}
			return true;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const next = trigger.player.judge(card => {
				if (get.color(card) == "red") {
					return 2;
				}
				return -2;
			});
			next.judge2 = result => result.bool;
			const result = await next.forResult();
			await player.gain(result.card, "gain2");
			if (result.bool) {
				//await player.draw();
				trigger.result = { bool: true, card: { name: "shan", isCard: true } };
				trigger.responded = true;
				trigger.animate = false;
			}
		},
	},
	ql_xiaoyao: {
		trigger: {
			player: ["useCardAfter", "respondAfter"]
		},
		forced: true,
		filter(event, player) {
			return ["sha", "shan"].includes(event.card.name);
		},
		async content(event, trigger, player) {
			player.addMark(event.name);
		},
		intro: {
			content: "mark",
		},
		group: "ql_xiaoyao_use",
		subSkill: {
			use: {
				trigger: {
					player: ["shaMiss", "eventNeutralized"],
					target: "shaMiss",
				},
				usable: 1,
				filter(event, player) {
					if (event.type != "card" || event.card.name != "sha") {
						return false;
					}
					const card = new lib.element.VCard({ name: "sha" });
					if (event.player != player) {
						return event.player?.isIn() && player.canUse(card, event.player, false, false);
					}
					return event.target?.isIn() && player.canUse(card, event.target, false, false);
				},
				logTarget(event, player) {
					return event[event.player == player ? "target" : "player"];
				},
				check(event, player) {
					const card = new lib.element.VCard({ name: "sha" });
					const target = lib.skill.ql_xiaoyao_use.logTarget(event, player);
					return get.effect(target, card, player, player) > 0;
				},
				prompt2(event, player) {
					const target = lib.skill.ql_xiaoyao_use.logTarget(event, player);
					return `你可以视为对${get.translation(target)}使用一张【杀】。`;
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					await player.draw();
					const card = new lib.element.VCard({ name: "sha" });
					if (player.canUse(card, target, false, false)) {
						await player.useCard(card, target, false);
					}
				},
			},
		},
	},
	ql_huihao: {
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			return event.card.name == "sha" && player.hasMark("ql_xiaoyao")
		},
		async cost(event, trigger, player) {
			const list = [
				"此【杀】不可被响应",
				"此牌造成伤害后回复体力",
				"此【杀】伤害+1",
				"此【杀】额外结算一次",
			].map((info, index) => [index, info]);
			event.result = await player
				.chooseButton([
					`${get.translation(event.skill)}：移去任意枚“逍遥”标记执行等量项`,
					[list.slice(0, 2), "tdnodes"],
					[list.slice(2, 4), "tdnodes"],
					[
						dialog => {
							dialog.buttons.forEach(i => {
								i.style.setProperty("width", "200px", "important");
								i.style.setProperty("text-align", "left", "important");
							});
						},
						"handle",
					],
				], [1, player.countMark("ql_xiaoyao")])
				.set("ai", button => {
					return 1 + Math.random();
				})
				.forResult();
			if (event?.result?.links?.length) {
				event.result.cost_data = event.result.links;
			}
		},
		async content(event, trigger, player) {
			const links = event.cost_data;
			player.removeMark("ql_xiaoyao", links.length);
			await player.draw(links.length);
			if (links.includes(0)) {
				trigger.directHit.addArray(game.filterPlayer());
				game.log(trigger.card, "不可被响应");
			}
			if (links.includes(1)) {
				player.addTempSkill(event.name + "_effect");
				player.markAuto(event.name + "_effect", trigger.card);
			}
			if (links.includes(2)) {
				trigger.baseDamage++;
				game.log(trigger.card, "伤害+1");
			}
			if (links.includes(3)) {
				trigger.effectCount++;
				game.log(trigger.card, "额外结算一次");
			}
		},
		ai: {
			combo: "ql_xiaoyao",
		},
		subSkill: {
			effect: {
				trigger: {
					source: "damageSource",
				},
				forced: true,
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return event.card && player.hasStorage("ql_huihao_effect", event.card);
				},
				async content(event, trigger, player) {
					player.recover();
				},
			},
		},
	},
	//卢锡安
	ql_shengqiang: {
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			return player.getHistory("useCard").indexOf(event) == 0;
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			if (trigger.targets?.length && get.type(trigger.card) != "equip") {
				player.markAuto(`${event.name}_effect`, trigger.card.name);
				player.addTempSkill(`${event.name}_effect`);
			} else {
				player.markAuto(`${event.name}_draw`, trigger.card.name);
				player.addTempSkill(`${event.name}_draw`);
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				forced: true,
				trigger: {
					player: "useCard",
				},
				onremove: true,
				filter(event, player) {
					return player.getStorage("ql_shengqiang_effect").includes(event.card.name);
				},
				async content(event, trigger, player) {
					trigger.effectCount++;
					game.log(trigger.card, "额外结算一次");
				},
				intro: {
					content: "使用$额外结算一次",
				}
			},
			draw: {
				charlotte: true,
				forced: true,
				trigger: {
					player: "useCard",
				},
				onremove: true,
				filter(event, player) {
					return player.getStorage("ql_shengqiang_draw").includes(event.card.name);
				},
				async content(event, trigger, player) {
					await player.draw();
				},
				intro: {
					content: "使用$时摸一张牌",
				}
			},
		}
	},
	ql_toushe: {
		enable: "chooseToUse",
		hiddenCard(player, name) {
			if (name == "huogong") {
				return player.hasCard(card => !get.is.damageCard(card) && player.canRecast(card), "he");
			}
			if (name == "shan") {
				return player.hasCard(card => get.is.damageCard(card) && player.canRecast(card), "he");
			}
			return false;
		},
		filter(event, player) {
			return get.info("ql_toushe").getList(event, player).length > 0;
		},
		getList(event, player) {
			const list = [];
			if (
				player.hasCard(card => !get.is.damageCard(card) && player.canRecast(card), "he") &&
				event.filterCard(get.autoViewAs({ name: "huogong", isCard: true }), player, event)
			) {
				list.push(["trick", "", "huogong"]);
			}
			if (
				player.hasCard(card => get.is.damageCard(card) && player.canRecast(card), "he") &&
				event.filterCard(get.autoViewAs({ name: "shan", isCard: true }), player, event)
			) {
				list.push(["basic", "", "shan"]);
			}
			return list;
		},
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				const list = get.info("ql_toushe").getList(event, player);
				const dialog = ui.create.dialog("透射", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				return true;
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
						isCard: true,
						suit: "none",
						number: null,
						color: "none",
					},
					links,
					filterCard(card, player) {
						const name = get.info("ql_toushe_backup").links[0][2];
						if (name == "huogong") {
							return !get.is.damageCard(card) && player.canRecast(card);
						}
						return get.is.damageCard(card) && player.canRecast(card);
					},
					log: false,
					position: "he",
					popname: true,
					ignoreMod: true,
					async precontent(event, trigger, player) {
						const { cards } = event.result;
						player.logSkill("ql_toushe");
						player.addTempSkill("ql_toushe_effect");
						await player.recast(cards);
						event.result.cards = [];
					}
				}
			},
			prompt(links, player) {
				if (links[0][2] == "huogong") {
					return "重铸一张非伤害牌并视为使用【火攻】";
				}
				return "重铸一张伤害牌并视为使用【闪】";
			}
		},
		subSkill: {
			effect: {
				trigger: {
					player: "useCardAfter",
				},
				filter(event, player) {
					return event.skill == "ql_toushe_backup";
				},
				charlotte: true,
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const { name } = trigger.card;
					let cards = [];
					if (name == "huogong") {
						player.checkHistory("lose", evt => {
							if (evt.type == "discard" && evt.getParent(4) == trigger) {
								cards.addArray(evt.cards2.filterInD("od"));
							}
						})
					}
					if (name == "shan") {
						const sha = trigger.respondTo[1];
						cards = sha.cards.filterInD("od");
					}
					while (cards?.length > 0) {
						const card = cards.shift();
						if (player.hasUseTarget(card, true, false) || (get.info(card).notarget && lib.filter.cardEnabled(card, player))) {
							await player.chooseUseTarget(card, false);
						}
					}
				}
			}
		},
		ai: {
			order: 10,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (!player.hasCard(card => get.is.damageCard(card) && player.canRecast(card), "he") || tag == "respond") {
					return false;
				}
			},
		}
	},
	ql_xili: {
		mod: {
			targetInRange(card) {
				return true;
			},
			cardUsable(card) {
				if (card.storage.ql_xili) {
					return Infinity;
				}
			},
		},
		enable: "phaseUse",
		usable: 1,
		locked: true,
		async content(event, trigger, player) {
			/*const result = await player.ql_chooseMultiTarget({ totalCount: 5 }).forResult();
			console.log(result);*/
			await player.draw();
			let { cards } = await player.showHandcards().forResult();
			player.addGaintag(cards, event.name);
			const targets = game.filterPlayer(target => {
				return player.hasCard(card => player.canUse(get.autoViewAs({ name: "sha" }, [card]), target, true, false));
			});
			if (targets?.length) {
				const result = await player
					.chooseTarget({
						prompt: `洗礼：请选择要使用【杀】的目标`,
						forced: true,
						targets,
						filterTarget(card, player, target) {
							return get.event().targets.includes(target);
						}
					})
					.forResult();
				if (result?.targets?.length) {
					const [target] = result.targets;
					player.line(target);
					while (true) {
						cards = player.getCards("h", card => card.hasGaintag(event.name));
						if (!cards.some(card => player.canUse(get.autoViewAs({ name: "sha" }, [card]), target, true, false)) || !target.isIn()) {
							break;
						}
						await player.chooseToUse()
							.set("openskilldialog", "洗礼：将一张展示牌当作【杀】对使>用")
							.set("norestore", true)
							.set("_backupevent", `${event.name}_backup`)
							.set("custom", {
								add: {},
								replace: { window() { } },
							})
							.backup(`${event.name}_backup`)
							.set("targetRequired", true)
							.set("complexTarget", true)
							.set("complexSelect", true)
							.set("sourcex", target)
							.set("filterTarget", function (card, player, target) {
								const { sourcex } = get.event();
								if (target != sourcex && !ui.selected.targets.includes(sourcex)) {
									return false;
								}
								return lib.filter.filterTarget.apply(this, arguments);
							})
							.set("addCount", false);
					}
				}
			}
			player.removeGaintag(event.name);
		},
		subSkill: {
			backup: {
				viewAs: {
					name: "sha",
					storage: {
						ql_xili: true,
					}
				},
				filterCard(card, player) {
					return get.itemtype(card) == "card" && card.hasGaintag("ql_xili");
				},
				selectTarget() {
					if (get.player().storage.ql_xili_upgrade) {
						return [1, Infinity];
					}
					const select = lib.filter.selectTarget();
					if (select[1] > 0) {
						select[1]++
					}
					return select;
				},
				position: "h",
				selectCard: 1,
				check(card) {
					return 6 - get.value(card);
				},
				log: false,
				async precontent(event, trigger, player) {
					const { cards } = event.result;
					const type = get.type2(cards[0]);
					if (type == "trick") {
						event.result.card.nature = "thunder";
					}
					if (type == "equip") {
						event.result.card.nature = "fire";
					}
					event.getParent().oncard = function () {
						const { card, player } = get.event();
						player.addTempSkill("ql_xili_draw");
						if (get.player().storage.ql_xili_upgrade) {
							player
								.when("useCard")
								.filter(evt => evt.card == card)
								.then(async (event, trigger, player) => {
									trigger.baseDamage *= 20;
								})
						}
					}
				},
			},
			draw: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: {
					source: "damageSource",
				},
				filter(event, player) {
					return event.card?.storage?.ql_xili;
				},
				async content(event, trigger, player) {
					await player.draw();
				}
			},
			die: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: {
					source: "dieAfter",
				},
				filter(event, player) {
					return event.card?.storage?.ql_xili;
				},
				async content(event, trigger, player) {
					player.addMark("ql_xili", 1, false);
					if (player.countMark("ql_xili") >= 5) {
						player.setStorage("ql_xili_upgrade", true);
					}
				}
			},
		},
		ai: {
			order: 5,
			result: {
				player(player, target) {
					if (game.hasPlayer(target => get.effect(target, get.autoViewAs({ name: "sha" }, "unsure"), player, player) > 0)) {
						return 1;
					}
				}
			}
		}
	},
	//莫德凯撒
	ql_mingchui: {
		trigger: {
			source: ["damageBegin1", "damageSource"],
		},
		forced: true,
		filter(event, player) {
			if (!event.card) {
				return false;
			}
			const evt = event.getParent("useCard");
			return evt?.targets?.length == 1 && get.is.damageCard(evt.card);
		},
		async content(event, trigger, player) {
			if (event.triggername == "damageBegin1") {
				trigger.num++;
			} else {
				await player.draw(2);
			}
		},
	},
	ql_buhuai: {
		mark: true,
		locked: false,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage, player, skill) {
				if (storage) {
					return "阴：你可以重铸一张非伤害牌，获得一名其他角色一张牌。";
				}
				return "阳：你可以重铸一张非伤害牌，获得一点护甲。";
			},
		},
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (!player.countCards("he", card => lib.skill.ql_buhuai.filterCard(card))) {
				return false;
			}
			if (!player.storage.ql_buhuai) {
				return true;
			}
			return game.hasPlayer(target => lib.skill.ql_buhuai.filterTarget(null, player, target));
		},
		filterCard: (card, player = get.owner(card), source, strict) => {
			if (get.is.damageCard(card)) {
				return false;
			}
			if (!player) {
				if (player === null) console.trace(`cardRecastable的player参数不应传入null,可以用void 0或undefined占位`);
				player = get.owner(card);
			}
			if (get.name(card) != "sha") return true;
			const mod = game.checkMod(card, player, source, "unchanged", "cardRecastable", player);
			if (!mod) return false;
			if (strict && mod == "unchanged") {
				if (get.position(card) != "h") return false;
				const info = get.info(card), recastable = info.recastable || info.chongzhu;
				return Boolean(typeof recastable == "function" ? recastable(_status.event, player) : recastable);
			}
			return true;
		},
		position: "he",
		filterTarget(card, player, target) {
			if (!player.storage.ql_buhuai) {
				return false;
			}
			return target != player && target.countGainableCards(player, "he");
		},
		selectTarget() {
			const player = get.event().player;
			if (player?.storage?.ql_buhuai) {
				return 1;
			}
			return -1;
		},
		lose: false,
		discard: false,
		delay: false,
		prompt() {
			const player = get.event().player;
			if (player?.storage.ql_buhuai) {
				return "阴：你可以重铸一张非伤害牌，获得一名其他角色一张牌。";
			}
			return "阳：你可以重铸一张非伤害牌，获得一点护甲。";
		},
		async content(event, trigger, player) {
			await player.changeZhuanhuanji(event.name);
			if (event.cards.length) {
				await player.recast(event.cards);
			}
			if (event.targets?.length) {
				await player.gainPlayerCard(event.targets[0], "he", true);
			} else {
				await player.changeHujia(1);
			}
		},
		ai: {
			order: 7,
			result: {
				player(player) {
					return 1;
				},
				target(player, target) {
					return get.effect(target, { name: "shunshou", position: "he" }, player);
				},
			},
		},
		group: ["ql_buhuai_change", "ql_buhuai_restore"],
		subSkill: {
			change: {
				trigger: {
					player: "phaseBegin",
				},
				forced: true,
				locked: false,
				filter(event, player) {
					return player.hujia;
				},
				async content(event, trigger, player) {
					const num = player.hujia;
					const delt = num - player.getDamagedHp();
					await player.changeHujia(-num);
					if (delt > 0) {
						await player.draw(delt);
					}
				},
			},
			restore: {
				trigger: {
					source: "damageSource",
				},
				forced: true,
				popup: false,
				locked: false,
				filter(event, player) {
					return player.getStat().skill.ql_buhuai;
				},
				content() {
					if (player.getStat().skill.ql_buhuai) {
						delete player.getStat().skill.ql_buhuai;
						game.log(player, "重置了", "#g【不坏】");
					}
				},
			},
		},
	},
	ql_tianjixian: {
		nobracket: true,
		trigger: {
			global: "roundStart",
		},
		popup: false,
		limited: true,
		filter(event, player2) {
			return game.hasPlayer(target => {
				if (target == player2) {
					return false;
				}
				return player2.hasAllHistory("useSkill", evt => evt.skill == "ql_buhuai" && evt?.targets?.includes(target));
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player2, target) => {
					if (target == player2) {
						return false;
					}
					return player2.hasAllHistory("useSkill", evt => evt.skill == "ql_buhuai" && evt?.targets?.includes(target));
				})
				.set("ai", target => {
					const player = get.player();
					return -get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const target = event.targets[0];
			player.logSkill(event.name, target);
			const num = player.getAllHistory("useSkill", evt => evt.skill == event.name).length;
			if (num > 5) {
				const targets = game.filterPlayer(target => target != player);
				const func = async target => {
					await target.loseHp();
					await player.recover();
					await target.loseMaxHp();
					await player.gainMaxHp();
				};
				await game.doAsyncInOrder(targets, func);
			}
			await target.loseHp();
			await player.recover();
			await target.loseMaxHp();
			await player.gainMaxHp();
			const cards = target.getGainableCards(player, "he");
			if (cards.length) {
				await player.gain(target, cards.randomGets(Math.ceil(cards.length / 2)), "give", "bySelf");
			}
			if (!target?.isIn()) {
				return;
			}
			player.addSkill(event.name + "_effect");
			player.markAuto(event.name + "_restore", [target]);
			const targets2 = game.filterPlayer(current => current != player && current != target);
			if (!targets2.length) {
				return;
			}
			for (const target2 of targets2) {
				target2.out("ql_tianjixian");
				target2._ql_tianjixian = true;
			}
		},
		subSkill: {
			effect: {
				trigger: {
					global: "roundStart",
				},
				forced: true,
				silent: true,
				firstDo: true,
				forceDie: true,
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					delete player.storage[skill + "_restore"];
				},
				async content(event, trigger, player) {
					if (!player.storage[event.name]) player.storage[event.name] = true;
					else {
						player.removeSkill(event.name);
						const targets = game.filterPlayer2(target => target._ql_tianjixian, [], true);
						for (const target of targets) {
							target.in("ql_tianjixian");
							delete target._ql_tianjixian;
						}
					}
				},
				group: ["ql_tianjixian_buff", "ql_tianjixian_clear", "ql_tianjixian_restore"],
			},
			buff: {
				mod: {
					cardUsable: () => Infinity,
				},
				/*trigger: {
					player: "phaseDrawBegin2",
				},
				forced: true,
				charlotte: true,
				filter(event, player) {
					return !event.numFixed;
				},
				async content(event, trigger, player) {
					trigger.num += 2;
				},*/
			},
			clear: {
				trigger: {
					global: "dieAfter",
				},
				forced: true,
				silent: true,
				firstDo: true,
				forceDie: true,
				forceOut: true,
				charlotte: true,
				filter(event, player) {
					return [player, ...player.getStorage("ql_tianjixian_restore")].includes(event.player);
				},
				async content(event, trigger, player) {
					if (player.getStorage("ql_tianjixian_restore").includes(trigger.player)) {
						player.restoreSkill("ql_tianjixian");
						game.log(player, "重置了", "#g【天际线】");
					}
					player.removeSkill("ql_tianjixian_effect");
					const targets = game.filterPlayer2(target => target._ql_tianjixian, [], true);
					for (const target of targets) {
						target.in("ql_tianjixian");
						delete target._ql_tianjixian;
					}
				},
			},
		},
	},
	//麟趾马蹄金
	ql_shuoyao: {
		trigger: {
			player: "phaseUseBegin",
		},
		async cost(event, trigger, player) {
			const card = get.autoViewAs({ name: "sha", isCard: true, storage: { [event.skill]: true } });
			const targets = game.filterPlayer(target => player.canUse(card, target));
			if (!targets.length) {
				return;
			}
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return get.event().targets.includes(target);
				})
				.set("targets", targets)
				.set("card", card)
				.set("ai", target => {
					return get.effect(target, get.event().card, get.player(), get.player());
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets: [target] } = event;
			target.addSkill(event.name + "_damage");
			const card = get.autoViewAs({ name: "sha", isCard: true, storage: { [event.name]: true } });
			const next = player.useCard(target, card, false);
			player.addTempSkill(event.name + "_directHit");
			await next;
			const name = "ql_linzhijin";
			const toRemove = game.filterPlayer2(target => target.name == name && target._source == player, true);
			if (toRemove) {
				await game.doAsyncInOrder(toRemove, async target => player.ql_removePlayer(target, { forceDie: true, forceOut: true }));
			}
			const callback = async (event, player) => {
				player.addSkill("ql_linzhijinx");
			}
			for (let i = 0; i < 3; i++) {
				await player.ql_addPlayer(target, name, null, Math.random() > 0.5, { startCards: 0, noCheckResult: true, callback });
			}
		},
		ai: {
			unequip: true,
			skillTagFilter: function (player, tag, arg) {
				if (!arg || !arg?.card?.storage?.ql_shuoyao) return false;
			},
		},
		subSkill: {
			damage: {
				charlotte: true,
				forced: true,
				trigger: {
					source: "damageBegin1",
				},
				filter(event, player) {
					return (
						event.player != player &&
						event.player.name != "ql_linzhijin" &&
						game.hasPlayer(target => {
							return target != player && target.hasSkill("ql_shuoyao")
						}) &&
						[player.getNext(), player.getPrevious()].some(target => target.name == "ql_linzhijin")
					);
				},
				async content(event, trigger, player) {
					trigger.num -= [player.getNext(), player.getPrevious()].filter(target => target.name == "ql_linzhijin").length;
				}
			},
			directHit: {
				charlotte: true,
				trigger: {
					player: "useCardToBegin",
				},
				filter(event, trigger, player) {
					if (!event.target?.isIn()) {
						return false;
					}
					return event.card.name === "sha" && event.card.storage?.ql_shuoyao;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const { card, target } = trigger;
					let bool;
					if (!target.countDiscardableCards(target, "e")) {
						bool = false;
					} else {
						const result = await target
							.chooseBool({
								prompt: `烁耀：你需弃置装备区所有牌，否则无法响应${get.translation(card)}`,
								choice: (() => {
									if (get.effect(target, card, player, target) >= 0) {
										return false;
									}
									const num = target.countCards("hs", { name: "shan" });
									if (num === 0) {
										return false;
									}
									return true;
								})()
							})
							.forResult();
						bool = result.bool;
					}
					if (!bool) {
						trigger.set("directHit", true);
						game.log(target, "不可响应", card);
					}
				},
			}
		}
	},
	ql_jincheng: {
		trigger: {
			player: ["addPlayerAfter"],
			global: ["dieAfter"],
		},
		filter(event, player) {
			if (event.name == "addPlayer") {
				return event.rawPairs[0] == "ql_linzhijin";
			}
			return !event.reverseOut && event.player._source == player && event.player.name == "ql_linzhijin";
		},
		logTarget(event, player) {
			const max = game.players.reduce((max, target) => {
				const num = target.getAllHistory("gain", evt => evt.getParent().name == "draw").reduce((sum, evt) => sum + evt.cards.length, 0);
				return num > max ? [target] : (num == max ? [target, ...max] : max);
			}, []);
			return max.sortBySeat();
		},
		check: () => true,
		async content(event, trigger, player) {
			const { targets } = event;
			await game.asyncDraw([player, ...targets], 2);
			const max = game.players.reduce((max, target) => {
				const num = game.getAllGlobalHistory("changeHp", evt => evt.getParent().name == "recover" && evt.player == target).length;
				return num > max ? [target] : (num == max ? [target, ...max] : max);
			}, []).sortBySeat();
			const result = await player
				.chooseBool(`金呈：是否与${get.translation(max)}各回复一点体力`, () => true)
				.forResult();
			if (result.bool) {
				await game.doAsyncInOrder([player, ...max], async target => target.recover(), () => 0);
			}
		},
		locked: false,
		mod: {
			targetInRange(card, player, target) {
				if (game.hasPlayer(target => target._source == player && target.name == "ql_linzhijin")) {
					return true;
				}
			}
		}
	},
	ql_linrui: {
		forced: true,
		trigger: {
			global: "die",
		},
		filter(event, player) {
			return !event.reverseOut && event.player._source == player && event.player.name == "ql_linzhijin";
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const list = ["draw", "sha", "hand", "dist"];
			const { targets: [target] } = event;
			const result = await player
				.chooseControl({
					prompt: "麟瑞：请选择要增加的数值",
					choiceList: [
						"摸牌阶段摸牌数",
						"出杀次数",
						"手牌上限",
						"防御距离",
					],
					choice: get.rand(0, 3),
				})
				.forResult();
			const { index } = result;
			if (index >= 0 && index < 4) {
				const choice = list[index];
				player.addSkill(event.name + "_effect");
				const storage = player.getStorage(event.name + "_effect", { draw: 0, sha: 0, hand: 0, dist: 0, });
				storage[choice]++;
				player.setStorage(event.name + "_effect", storage, true);
			}
			await player.draw();
			player.addTempSkill(event.name + "_effectCount", { player: "dieAfter" });
			const targets = [target.getNext(), target.getPrevious()].toUniqued().filter(target => target != player);
			if (targets.length) {
				targets.forEach(target => target.addTempSkill(event.name + "_loseHp", { player: "dieAfter" }));
			}
			if (game.getAllGlobalHistory("everything", evt => {
				return (
					evt.name == "die" &&
					evt.player._source &&
					!evt.reverseOut
				)
			}).length % 3 == 0) {
				player.insertPhase();
			}
		},
		subSkill: {
			effectCount: {
				charlotte: true,
				forced: true,
				mark: true,
				intro: {
					content: "下次使用的牌额外结算一次",
				},
				trigger: {
					player: "useCard",
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					trigger.effectCount++;
				}
			},
			loseHp: {
				charlotte: true,
				forced: true,
				mark: true,
				intro: {
					content: "下次受到伤害后失去一点体力",
				},
				trigger: {
					player: "damageEnd",
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					await player.loseHp();
				}
			},
			effect: {
				init(player, skill) {
					player.storage[skill] = {
						draw: 0,
						sha: 0,
						hand: 0,
						dist: 0,
					}
				},
				onremove: true,
				intro: {
					markcount(storage) {
						return Object.values(storage).join("");
					},
					content(storage, player) {
						return `
							<li>摸牌阶段摸牌数：${storage["draw"]}<br>
							<li>出杀次数：${storage["sha"]}<br>
							<li>手牌上限：${storage["hand"]}<br>
							<li>防御距离：${storage["dist"]}
						`
					},
				},
				trigger: {
					player: "phaseDrawBegin2",
				},
				filter(event, player) {
					return !event.numFixed && player.getStorage("ql_linrui_effect", { draw: 0, sha: 0, hand: 0, dist: 0, })["draw"] > 0;
				},
				forced: true,
				async content(event, trigger, player) {
					trigger.num += player.getStorage(event.name, { draw: 0, sha: 0, hand: 0, dist: 0, })["draw"];
				},
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						if (get.name(card) == "sha") {
							return num + player.getStorage("ql_linrui_effect", { draw: 0, sha: 0, hand: 0, dist: 0, })["sha"];
						}
					},
					maxHandcard(player, num) {
						return num + player.getStorage("ql_linrui_effect", { draw: 0, sha: 0, hand: 0, dist: 0, })["hand"];
					},
					globalTo(from, to, distance) {
						return distance + to.getStorage("ql_linrui_effect", { draw: 0, sha: 0, hand: 0, dist: 0, })["dist"];
					}
				}
			},
		}
	},
	ql_linzhijinx: {
		charlotte: true,
		forced: true,
		popup: false,
		init(player, skill) {
			if (!player.isTurnedOver()) {
				player.turnOver(true);
			}
		},
		trigger: {
			player: ["gainBefore", "turnOverBefore"],
		},
		filter(event, player) {
			if (event.name == "turnOver") {
				return player.isTurnedOver();
			}
			return true;
		},
		async content(event, trigger, player) {
			trigger.cancel();
			if (trigger.name == "gain") {
				const cards = trigger.cards.filter(card => !get.position(card) && card.original == "c");
				if (cards.length) {
					ui.cardPile.prepend(cards);
				}
				const discard = trigger.cards.filter(card => !cards.includes(card) && !get.position(card));
				if (discard.length) {
					await game.cardsDiscard(discard);
				}
			}
		}
	},
	//云雷纹大铙
	ql_zhigu: {
		trigger: {
			global: "phaseZhunbeiBegin",
		},
		async cost(event, trigger, player) {
			event.result = await player.chooseCard()
				.set("filterCard", (card) => {
					return true;
				})
				.set("selectCard", [0, 1])
				.set("prompt", "是否弃置一张牌令其本回合使用牌无次数限制或点确定摸一张牌")
				.forResult();
		},
		async content(event, trigger, player) {
			if (event.cards) {
				await player.modedDiscard(event.cards);
				trigger.player.addTempSkill(event.name + "_effect");
				return;
			}
			await player.draw();
		},
		subSkill: {
			effect: {
				charlotte: true,
				forced: true,
				mod: {
					targetInRange(card) {
						return true;
					}
				},
				trigger: {
					source: "damageSource",
				},
				filter(event, player) {
					return player.hasHistory("sourceDamage", evt => evt != event);
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
		},
	},
	ql_leimi: {
		trigger: { global: "useCardToTarget" },
		filter(event, player) {
			const num = get.number(event.card);
			return (
				get.suit(event.card) == "spade" &&
				(num >= 2 && num <= 9)
			);
		},
		async content(event, trigger, player) {
			const { cards, card, target } = trigger;
			trigger.getParent().excluded.add(target);
			game.log(card, "对", target, "无效");
			if (cards.length) {
				const vcard = get.autoViewAs({ name: "pyzhuren_shandian", cards }, cards);
				if (target.canEquip(vcard, true)) {
					await target.equip(vcard);
				}
			}
		},
	},
	//彩凤鸣岐
	ql_luoxia: {
		forced: true,
		markimage: "image/card/handcard.png",
		mod: {
			maxHandcard(player, num) {
				return num + player.hujia;
			},
			targetInRange(card, player, target) {
				if (player.getStorage("ql_luoxia_effect").includes(target)) {
					return true;
				}
			},
			globalTo(from, to, distance) {
				return distance + to.hujia;
			}
		},
		trigger: {
			player: ["phaseUseBegin", "useCard", "useCardAfter"],
			source: "damageSource",
		},
		filter(event, player, name) {
			const storage = player.getStorage("ql_luoxia_effect");
			switch (name) {
				case "useCardAfter":
					return event.card.name == "sha" && storage.some(p => event?.targets?.includes(p));
					break;
				case "useCard":
					return event.card.name == "sha" && storage.some(p => {
						return event?.targets?.includes(p) && player.getHistory("useCard", evt => evt.card.name == "sha" && evt?.targets?.includes(p)).indexOf(event) == 0;
					});
					break;
				case "damageSource":
					return storage.some(p => p.getHistory("damage", evt => evt?.source == player).indexOf(event) == 0) && game.hasPlayer(current => current != player && current != event.player);
					break;
				default:
					return true;
					break;
			}
		},
		async content(event, trigger, player) {
			const storage = player.getStorage(event.name + "_effect");
			switch (event.triggername) {
				case "useCardAfter": {
					const target = storage[storage.length - 1];
					let result = { bool: false };
					const num = player.getHistory("useCard", evt => evt.card.name == "sha" && evt?.targets?.includes(target)).length;
					if (target.isIn() && num <= 3) {
						await player.draw(num);
						result = await player.chooseToUse(
							function (card, player, event) {
								if (get.name(card) != "sha") {
									return false;
								}
								return lib.filter.filterCard.apply(this, arguments);
							},
							target,
							-1
						)
							.set("addCount", false)
							.set("prompt", `对${get.translation(target)}使用一张【杀】或点取消获得${get.translation(num)}点护甲`)
							.forResult();
					}
					if (!result.bool) {
						await player.changeHujia(num);
						player.addTempSkill(event.name + "_ban");
					}
					return;
				}
				case "useCard": {
					trigger.baseDamage++;
					return;
				}
				case "damageSource": {
					const result = await player.chooseTarget()
						.set("filterTarget", (card, player, target) => {
							return target != trigger.target && target != player;
						})
						.set("prompt", `令一名${get.translation(trigger.target)}之外的角色失去一点体力`)
						.set("ai", (target) => {
							const player = _status.event.player;
							return get.effect(target, { name: "losehp" }, player, player);
						})
						.set("target", trigger.target)
						.forResult();
					if (result.bool) {
						await result.targets[0].loseHp();
					}
					return;
				}
				default: {
					const num = player?.hujia;
					if (num > 0) {
						await player.changeHujia(-num);
						await player.draw(num);
					}
					const result = await player.chooseTarget()
						.set("filterTarget", (card, player, target) => {
							return target != player;
						})
						.set("prompt", "###落霞###你选择一名其他角色，本回合可对其造成多段伤害")
						.set("ai", (target) => {
							const player = get.player();
							return -get.attitude(player, target);
						})
						.set("forced", true)
						.forResult();
					if (result?.bool) {
						player.addTempSkill(event.name + "_effect");
						player.markAuto(event.name + "_effect", result.targets[0]);
					}
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				intro: {
					content: "对$使用牌无距离限制",
				},
			},
			ban: {
				charlotte: true,
				mod: {
					cardEnabled(card) {
						if (card.name == "sha") {
							return false;
						}
					}
				},
			},
		},
	},
	ql_wanlai: {

	},
	//鎏金骑士
	ql_zhujia: {
		trigger: {
			player: ["phaseBegin", "damageEnd"],
			source: "damageSource",
		},
		forced: true,
		filter(event, player, name) {
			return (name == "damageEnd" && !player.countMark("ql_zhujia_append")) || (name != "damageEnd" && !player.countMark("ql_zhujia_attack"));
		},
		async content(event, trigger, player) {
			const { name } = event;
			const info = get.info(name);
			if (event.triggername == "damageEnd") {
				player.addMark(name + "_append");
			} else {
				player.addMark(name + "_attack");
			}
			if (player.countMark(name + "_append") && player.countMark(name + "_attack")) {
				player.clearMark(name + "_append");
				player.clearMark(name + "_attack");
				if (!info.derivation.every(skill => player.getSkills(null, false, false).filter(i => !get.info(i).charlotte).includes(skill))) {
					for (let i of info.derivation) {
						if (!player.hasSkill(i)) {
							player.addSkills(i);
							break;
						}
					}
				} else {
					await player.draw(2);
				}
				player.storage.ql_zhujia_count = player.storage.ql_zhujia_count || 0;
				if (player.storage.ql_zhujia_count < 2) {
					await player.gainMaxHp();
					player.storage.ql_zhujia_count++;
				} else {
					await player.recover();
				}
			}
		},
		derivation: ["reganglie", "xinbenxi", "ql_shengshou"],
		subSkill: {
			append: {
				charlotte: true,
				mark: true,
				marktext: "守",
				intro: {
					name: "守势",
				},
			},
			attack: {
				charlotte: true,
				mark: true,
				marktext: "攻",
				intro: {
					name: "攻势",
				},
			},
		},
	},
	ql_chuanshuo: {
		marktext: "伤",
		intro: {
			content: "下一次造成伤害+$",
		},
		forced: true,
		trigger: {
			player: ["gainMaxHpAfter", "loseMaxHpAfter", "changeHpAfter", "recoverAfter"],
			source: "damageBegin1",
		},
		filter(event, player) {
			switch (event.name) {
				case "damage":
					return player.countMark("ql_chuanshuo");
					break;
				case "recover":
					return true;
					break;
				default:
					return event.num != 0;
					break;
			}
		},
		async content(event, trigger, player) {
			switch (trigger.name) {
				case "damage":
					trigger.num += player.countMark(event.name);
					player.clearMark(event.name);
					break;
				case "recover":
					player.addMark(event.name);
					break;
				default:
					await player.draw(Math.abs(trigger.num));
					break;
			}
		},
	},
	ql_shengshou: {
		forced: true,
		trigger: {
			player: "recoverBegin",
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
	},
	//死亡移除技能
	ql_dieRemove: {
		charlotte: true,
		silent: true,
		fixed: true,
		forceDie: true,
		forceOut: true,
		trigger: {
			global: ["dieAfter"],
		},
		filter(event, player) {
			return !event.reverseOut && (event.player == player || event.player == player._source);
		},
		async content(event, trigger, player) {
			const next = game.createEvent("ql_dieRemove_after", false, trigger);
			next.player = player;
			next.forceDie = true;
			next.forceOut = true;
			next.setContent(async (event, trigger, player) => {
				await player.ql_removePlayer();
			})
			trigger.next.remove(next);
			trigger.after.push(next);
		},
		mark: true,
		marktext: "👻",
		intro: {
			name: "死亡移除",
			content(storage, player, skill) {
				if (!player._source) {
					return `无事发生`;
				}
				const me = game.me._trueMe || game.me;
				if (player._source == me) {
					return `你是他/她的召唤者`;
				} else {
					return `你不是他/她的召唤者`;
				}
			},
		},
	},
	//T画
	ql_yinhun: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: ["phaseAfter", "phaseBefore"],
			player: "enterGame",
		},
		forced: true,
		filter(event, player, name) {
			if (name == "phaseAfter") {
				return player.getHistory("lose").reduce((sum, evt) => sum + evt.cards2.length, 0) > 12;
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async content(event, trigger, player) {
			let list = [];
			if (event.triggername == "phaseAfter") {
				const num = player.getHistory("lose").reduce((sum, evt) => sum + evt.cards2.length, 0);
				if (num > 12 && num <= 20) {
					list.push("ql_linggui");
				} else if (num > 20) {
					list = ["ql_linggui", "ql_jinwu"];
				}
			} else {
				list = ["ql_linggui", "ql_jinwu"];
			}
			if (!list.length) {
				return;
			}
			const result = await player
				.chooseButtonTarget({
					createDialog: [
						"引魂：你可以在两名角色中间召唤一个召唤物",
						[list, "character"],
					],
					forced: true,
					complexSelect: true,
					selectTarget: 2,
					filterTarget(card, player, target) {
						if (!ui.selected.targets?.length) {
							return true;
						}
						return [target.getPrevious(), target.getNext()].includes(ui.selected.targets[0]);
					},
					ai1(button) {
						return Math.random();
					},
					ai2(target) {
						return Math.random();
					}
				})
				.forResult();
			const { links, targets } = result;
			if (links?.length && targets?.length) {
				const [name] = links;
				targets.sortBySeat();
				let target = targets.find(i => i.getNext() == targets.find(j => j != i));
				let isNext = true;
				const toRemove = game.findPlayer2(target => target.name == name && target._source == player, true);
				if (toRemove) {
					await player.ql_removePlayer(toRemove, { forceDie: true, forceOut: true });
				}
				if (target.removed) {
					target = targets.find(i => i != target);
					isNext = false;
				}
				await player.ql_addPlayer(target, name, void 0, isNext);
			}
			await player.draw(2);
			if (event.triggername == "phaseAfter") {
				player.insertPhase();
			} else {
				const evt = player.insertPhase();
				evt.pushHandler("onPhase", (event, option) => {
					if (event.step === 0 && option.state === "begin") {
						event.step = 1;
					}
				});
				if (trigger.name == "phase" && !trigger._finished) {
					let first = game.findPlayer(current => current.getSeatNum() == 1) || trigger.player;
					trigger.finish();
					trigger._finished = true;
					trigger.untrigger(true);
					trigger._triggered = 5;
					const evtx = first.insertPhase();
					delete evtx.skill;
					const evt2 = trigger.getParent();
					if (evt2.name == "phaseLoop" && evt2._isStandardLoop) {
						evt2.player = first;
					}
				}
			}
		}
	},
	ql_furang: {
		audio: "ext:五花米线/audio/skill:2",
		usable: 1,
		enable: "chooseToUse",
		hiddenCard(player, name) {
			return ["sha", "huogong", "tao", "ql_jianbiqingye"].includes(name) && !player.getStat().skill.ql_furang && !get.event().ql_furang;
		},
		getList(event, player) {
			return get.inpileVCardList(info => {
				if ((info[2] == "sha" && info[3] != "fire") || !["sha", "huogong", "tao", "ql_jianbiqingye"].includes(info[2])) {
					return false;
				}
				return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event) && !event.ql_furang;
			})
		},
		filter(event, player) {
			return player.countDiscardableCards(player, "he") >= player.getHp() && get.info("ql_furang").getList(event, player).length > 0;
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.info("ql_furang").getList(event, player);
				return ui.create.dialog("祓禳", [list, "vcard"], "hidden");
			},
			check(button) {
				const player = get.player(),
					card = get.autoViewAs({ name: button.link[2], nature: button.link[3] }, "unsure");
				const val = player.getUseValue(card);
				return val;
			},
			backup(links, player) {
				return {
					filterCard: lib.filter.cardDiscardable,
					selectCard() {
						return player.getHp();
					},
					check(card) {
						return 7 - get.value(card);
					},
					ignoreMod: true,
					position: "he",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						color: "unsure",
						suit: "unsure",
						number: "unsure",
					},
					filterTarget: (card, player, target) => player == target,
					selectTarget: -1,
					log: false,
					ai1(card) {
						return 1 / (1.1 + Math.max(-1, get.value(card)));
					},
					ai2(target) {
						return 1;
					},
					async precontent(event, trigger, player) {
						const skill = "ql_furang";
						player.logSkill(skill);
						const { cards, card } = event.result;
						const viewAs = { name: card.name, nature: card.nature };
						await player.discard(cards);
						await player.draw();
						const evt = event.getParent();
						if (!player.hasCard(card => evt.filterCard(get.autoViewAs(viewAs, [card]), player, evt), "hes")) {
							evt.set(skill, true);
							evt.goto(0);
							return;
						}
						game.broadcastAll((viewAs) => {
							lib.skill.ql_furang_backup2.viewAs = viewAs;
						}, viewAs);
						evt.set("_backupevent", "ql_furang_backup2");
						evt.set("openskilldialog", `请选择${get.translation(viewAs.nature) || ""}${get.translation(viewAs.name)}的目标`);
						evt.backup("ql_furang_backup2");
						evt.set("norestore", true);
						evt.set("custom", {
							add: {},
							replace: {
								window() { }
							}
						});
						evt.goto(0);
					},
				};
			},
			prompt(links, player) {
				return "弃置" + player.getHp() + "张牌并摸一张牌然后将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order: 6,
			respondSha: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond") {
					return false;
				}
				if (player.countDiscardableCards(player, "he") < player.getHp()) {
					return false;
				}
				if (player.getStat().skill.ql_furang > 0) {
					return false;
				}
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		group: ["ql_furang_jinwu", "ql_furang_linggui"],
		subSkill: {
			backup: {},
			backup2: {
				filterCard: true,
				position: "hes",
				log: false,
			},
			debuff: {
				charlotte: true,
				mod: {
					cardEnabled(card, player) {
						if (get.type2(card) == "trick") {
							return false;
						}
					}
				},
				mark: true,
				intro: {
					content: "不能使用锦囊牌",
				}
			},
			linggui: {
				audio: "ql_furang",
				trigger: {
					player: "useCard",
				},
				filter(event, player) {
					if (!get.is.damageCard(event.card)) {
						return false;
					}
					const targets = [player, ...(event.targets || [])];
					const linggui = game.findPlayer(target => target.name == "ql_linggui" && target._source == player);
					return linggui && [linggui.getPrevious(), linggui.getNext()].containsSome(...targets) && event.targets?.length;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(get.prompt(event.skill), "令任意个目标不能使用锦囊牌至其回合结束", [1, Infinity], (card, player, target) => {
							return get.event().targets.includes(target);
						})
						.set("ai", target => -get.attitude(get.player(), target))
						.set("targets", trigger.targets)
						.forResult();
				},
				async content(event, trigger, player) {
					const { targets } = event;
					targets.forEach(target => target.addTempSkill("ql_furang_debuff", { player: "phaseAfter" }));
				}
			},
			jinwu: {
				audio: "ql_furang",
				trigger: {
					player: "useCard2",
				},
				filter(event, player) {
					if (!get.is.damageCard(event.card)) {
						return false;
					}
					const targets = [player, ...(event.targets || [])];
					const jinwu = game.findPlayer(target => target.name == "ql_jinwu" && target._source == player);
					return jinwu && [jinwu.getPrevious(), jinwu.getNext()].containsSome(...targets) &&
						game.hasPlayer(target => {
							return !event.targets.includes(target) && lib.filter.targetEnabled2(event.card, player, target) && lib.filter.targetInRange(event.card, player, target);
						})
				},
				async cost(event, trigger, player) {
					const targets = game.filterPlayer(target => {
						return !trigger.targets.includes(target) && lib.filter.targetEnabled2(trigger.card, player, target) && lib.filter.targetInRange(trigger.card, player, target);
					});
					event.result = await player
						.chooseTarget(get.prompt(event.skill), "额外指定一个目标且令其失去一点体力", (card, player, target) => {
							return get.event().targets.includes(target);
						})
						.set("ai", target => get.effect(target, get.event().card, get.player(), get.player()) + get.effect(target, { name: "losehp" }, get.player(), get.player()))
						.set("card", trigger.card)
						.set("targets", targets)
						.forResult();
				},
				async content(event, trigger, player) {
					const { targets } = event;
					trigger.targets.addArray(targets);
					game.log(targets, "成为了", trigger.card, "的额外目标");
					await targets[0].loseHp();
				}
			},
		},
	},
	ql_wange: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: ["drawBegin", "damageBegin1", "damageBegin3"],
		},
		forced: true,
		countFellow(player) {
			return game.countPlayer(target => target._source == player);
		},
		logTarget(event, player, name) {
			return name == "damageBegin1" ? event.source : event.player;
		},
		filter(event, player, name) {
			const target = name == "damageBegin1" ? event.source : event.player;
			if (!target?.isIn()) {
				return false;
			}
			if ((target != player && target._source != player) || (name == "damageBegin1" && target.name == "ql_linggui") || (name == "damageBegin3" && target != player)) {
				return false;
			}
			return get.info("ql_wange").countFellow(player) > 0;
		},
		async content(event, trigger, player) {
			const num = get.info(event.name).countFellow(player);
			if (event.triggername == "damageBegin3") {
				trigger.num -= num;
			} else {
				trigger.num += trigger.name == "draw" ? num + 1 : num;
			}
		}
	},
	ql_xianzhi: {
		trigger: {
			global: "phaseJieshuBegin",
		},
		filter(event, player) {
			return (
				!player.hasHistory("damage") &&
				player.countDiscardableCards(player, "he") > 2
			)
		},
		logTarget: () => _status.currentPhase,
		async cost(event, trigger, player) {
			const target = _status.currentPhase;
			event.result = await player
				.chooseToDiscard(get.prompt2(event.skill, target), "he", 3, "chooseonly")
				.set("ai", card => {
					if (get.event().goon) {
						return 7 - get.value(card);
					}
					return 0;
				})
				.set("goon", (get.attitude(player, target) < 0 && !target.isTurnedOver()) || (get.attitude(player, target) > 0 && target.isTurnedOver()))
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards, targets: [target] } = event;
			await player.modedDiscard(cards);
			await target.turnOver();
			const drawer = player._source;
			if (drawer?.isIn()) {
				player.line(drawer, "green");
				await drawer.draw();
			}
		},
	},
	ql_jiuyao: {
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countDiscardableCards(player, "he") > 4;
		},
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		selectCard: 5,
		selectTarget: [1, 3],
		filterTarget(card, player, target) {
			if (!ui.selected.targets?.length) {
				return true;
			}
			return ui.selected.targets.some(i => i.getPrevious() == target || i.getNext() == target);
		},
		check(card) {
			return 7.5 - get.value(card);
		},
		complexTarget: true,
		multiline: true,
		multitarget: true,
		async content(event, trigger, player) {
			const { targets } = event;
			await player.loseMaxHp(Math.ceil(player.maxHp / 2));
			await game.doAsyncInOrder(targets, async target => target.damage(2, "fire"));
			const drawer = player._source;
			if (drawer?.isIn()) {
				player.line(drawer, "green");
				await drawer.draw();
			}
		},
		ai: {
			order: 4,
			result: {
				target(player, target) {
					if (get.attitude(player, target) < 0) {
						return -get.damageEffect(target, player, player, "fire");
					}
					return 0;
				}
			}
		}
	},
	ql_luoyan: {
		trigger: {
			player: "die",
		},
		forced: true,
		locked: false,
		forceDie: true,
		filter(event, player) {
			return [player.getPrevious(), player.getNext()].some(i => i?.isIn());
		},
		async content(event, trigger, player) {
			const targetsx = [player.getPrevious(), player.getNext()].filter(i => i?.isIn());
			const result = await player
				.chooseTarget("落焱", "令上下家中的一名角色失去一点体力", true, (card, player, target) => {
					return get.event().targets.includes(target);
				})
				.set("ai", target => get.effect(target, { name: "losehp" }, get.player(), get.player()))
				.set("targets", targetsx)
				.forResult();
			const { targets } = result;
			if (targets?.length) {
				const [target] = targets;
				player.line(target, "yellow");
				await target.loseHp();
			}
		}
	},
	ql_zangsong: {
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			return true;
		},
		async content(event, trigger, player) {
			const card = get.cardPile(card => card.name == "du");
			if (card) {
				await trigger.player.gain(card, "gain2");
			}
		},
	},
	ql_whmx: {
		fixed: true,
		charlotte: true,
		superCharlotte: true,
		persevereSkill: true,
		forced: true,
		trigger: {
			gloabl: "phaseBefore",
			player: ["enterGame", "changeHpBegin"],
		},
		filter(event, player) {
			if (event.name != "changeHp") {
				return event.name != "phase" || game.phaseNumber == 0;
			}
			return true;
		},
		async content(event, trigger, player) {
			return;
		},
	},
	//刘璋
	ql_dimou: {
		forced: true,
		trigger: {
			global: "phaseEnd",
		},
		filter(event, player) {
			if (!event.player.isIn()) {
				return false;
			}
			return !event.player.hasHistory("useCard", evt => evt.targets.includes(player));
		},
		async content(event, trigger, player) {
			const { player: target } = trigger;
			await player.draw(2);
			if (target != player && player.canCompare(target)) {
				const result = await player.chooseToCompare(target).forResult();
				if (result.bool) {
					let cards = [];
					let card = get.cardPile(card => {
						return card.name == "sha";
					})
					if (card) {
						cards.push(card);
					}
					await player.gainMaxHp();
					if (cards.length) {
						target.gain(cards, "gain2");
					}
				} else {
					const positions = target.getDiscardableCards(player, "hej")
						.map(card => get.position(card))
						.toUniqued();
					if (positions.length > 0) {
						await player.discardPlayerCard(target, "hej", [1, positions.length], "visible")
							.set("filterButton", button => {
								const position = get.position(button.link);
								return ui.selected.buttons.every(buttonx => get.position(buttonx.link) != position);
							})
							.set("complexSelect", true)
							.forResult();
					}
				}
			}
		},
	},
	ql_juni: {
		trigger: {
			global: ["useCardAfter", "respondAfter"],
		},
		filter(event, player) {
			if (!event.respondTo) {
				return false;
			}
			if (event.player == player) {
				return false;
			}
			if (player != event.respondTo[0]) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			const { respondTo, player: target } = trigger;
			const cardUse = get.autoViewAs({ name: "sha", isCard: true });
			if (respondTo[0].canUse(cardUse, target, false, false)) {
				await respondTo[0].useCard(cardUse, target, false, false);
			}
		}
	},
	ql_shouchuan: {
		mod: {
			maxHandcard(player, num) {
				return num += (player.maxHp + game.countGroup());
			},
			cardEnabled(card, player) {
				const skill = "ql_shouchuan";
				if (player.countMark(skill) >= (player.maxHp + game.countGroup())) {
					return false;
				}
			},
			cardUsable(card, player) {
				const skill = "ql_shouchuan";
				if (player.countMark(skill) >= (player.maxHp + game.countGroup())) {
					return false;
				}
			},
			cardSavable(card, player) {
				const skill = "ql_shouchuan";
				if (player.countMark(skill) >= (player.maxHp + game.countGroup())) {
					return false;
				}
			},
		},
		trigger: {
			player: ["useCard", "phaseDrawBegin2"],
			global: "phaseJieshuBegin",
		},
		forced: true,
		filter(event, player) {
			return event.name != "phaseDraw" || !event.numFixed;
		},
		async content(event, trigger, player) {
			switch (trigger.name) {
				case "phaseDraw":
					trigger.num += (player.maxHp + game.countGroup());
					break;
				case "useCard":
					player.addMark(event.name, 1, false);
					if (player.countMark(event.name) <= 2) {
						trigger.card.storage.ql_shouchuan = true;
					}
					break;
				case "phaseJieshu":
					player.clearMark(event.name, false);
			}
		},
		group: "ql_shouchuan_damage",
		subSkill: {
			damage: {
				charlotte: true,
				forced: true,
				trigger: {
					source: "damageBegin1",
				},
				filter(event, player) {
					return event?.card?.storage?.ql_shouchuan;
				},
				async content(event, trigger, player) {
					trigger.num--;
				},
			},
		},
	},
	//蒋琬
	ql_shengxi: {
		enable: "chooseToUse",
		filter(event, player) {
			if (!player.countCards("hse") || ["black", "red"].every(color => player.getStorage("ql_shengxi_used").includes(color))) {
				return false;
			}
			const allCards = player.getStorage("ql_shengxi_card").length == 0 ? lib.inpile : player.getStorage("ql_shengxi_card");
			for (var i of allCards) {
				var type = get.type(i);
				if ((type == "basic" || type == "trick") && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = player.getStorage("ql_shengxi_card");
				if (list.length == 0) {
					for (var i = 0; i < lib.inpile.length; i++) {
						var name = lib.inpile[i];
						if (name == "sha") {
							if (event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
								list.push(["基本", "", "sha"]);
							}
							for (var nature of lib.inpile_nature) {
								if (event.filterCard(get.autoViewAs({ name, nature }, "unsure"), player, event)) {
									list.push(["基本", "", "sha", nature]);
								}
							}
						} else if (get.type(name) == "trick" && event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
							list.push(["锦囊", "", name]);
						} else if (get.type(name) == "basic" && event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
							list.push(["基本", "", name]);
						}
					}
				}
				return ui.create.dialog("生息", [list, "vcard"]);
			},
			backup(links, player) {
				return {
					links: links,
					filterCard(card, player) {
						return ["black", "red"].filter(c => !player.getStorage("ql_shengxi_used").includes(c)).includes(get.color(card, player));
					},
					popname: true,
					check(card) {
						return 8 - get.value(card);
					},
					position: "hse",
					viewAs: { name: links[0][2], nature: links[0][3] },
					async precontent(event, trigger, player) {
						const skill = "ql_shengxi";
						player.addTempSkill([skill + "_card", skill + "_used"])
						player.markAuto(skill + "_card", get.info(skill + "_backup").links[0][2]);
						player.markAuto(skill + "_used", get.color(event.result.card));
						player.addMark(skill + "_jieshu");
					},
				};
			},
			prompt(links, player) {
				return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		hiddenCard(player, name) {
			const allCards = player.getStorage("ql_shengxi_card").length == 0 ? lib.inpile : player.getStorage("ql_shengxi_card");
			if (!allCards.includes(name)) {
				return false;
			}
			var type = get.type2(name);
			return (type == "basic" || type == "trick") && player.countCards("she") > 0;
		},
		group: ["ql_shengxi_jieshu"],
		subSkill: {
			jieshu: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/handcard.png",
				intro: {
					content: "手牌上限+#",
				},
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("ql_shengxi_jieshu");
					}
				},
				trigger: {
					player: "phaseJieshuBegin",
				},
				frequent: true,
				/*filter(event, player) {
					return !player.hasHistory("sourceDamage", evt => evt.source == player);
				},*/
				async content(event, trigger, player) {
					player.clearMark("ql_shengxi_jieshu");
					if (!player.hasHistory("sourceDamage", evt => evt.source == player)) {
						const result = await player.chooseControl()
							.set("choiceList", [player.isMaxHandcard() ? "摸三张牌" : "摸两张牌", player.isMinHp() ? "回复两点体力" : "回复一点体力"])
							.forResult();
						/*game.log(result.bool)
						game.log(result.index)
						game.log(result.control)*/
						if (result.index == 0) {
							await player.draw(player.isMaxHandcard() ? 3 : 2);
						}
						if (result.index == 1) {
							await player.recover(player.isMinHp() ? 2 : 1);
						}
					}
				},
			},
			card: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "可以转化的牌：$",
				},
			},
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已转化过的颜色：$",
				},
			},
		},
	},
	ql_zhifa: {
		trigger: {
			global: "damageBegin2",
		},
		usable: 1,
		filter(event, player) {
			return event.source && event.source != player;
		},
		async cost(event, trigger, player) {
			event.result = await player.chooseToDiscard()
				.set("prompt", "是否弃置两张牌防止此伤害或翻面并摸两张牌防止此伤害")
				.set("selectCard", [0, 2])
				.set("filterOk", () => {
					return ui.selected.cards.length == 2 || ui.selected.cards.length == 0;
				}).forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			if (!cards) {
				await player.turnOver();
				await player.draw(2);
			}
			trigger.cancel();
		},
	},
	ql_jianshen: {
		trigger: {
			global: ["damageCancelled", "damageZero", "damageAfter", "phaseEnd"],
		},
		forced: true,
		filter(event, player, name) {
			if (name != "phaseEnd") {
				if (name == "damageCancelled") {
					return true;
				}
				for (var i of event.change_history) {
					if (i < 0) {
						return true;
					}
				}
				return false;
			} else {
				return player.countCards("h", card => card.hasGaintag("ql_jianshen_tag"));
			}
		},
		async content(event, trigger, player) {
			if (trigger.name != "phase") {
				await player.draw(3).gaintag.add("ql_jianshen_tag");
			} else {
				const cards = player.getCards("h", card => card.hasGaintag("ql_jianshen_tag"));
				await player.modedDiscard(cards);
			}
		},
	},
	//牛尊
	ql_yinge: {
		trigger: {
			player: "phaseBegin",
		},
		async content(event, trigger, player) {
			player.tempBanSkill(event.name, "roundStart", false);
			const cards = [];
			const nameList = [];
			while (cards.length < 4) {
				const card = get.cardPile(card => {
					if (nameList.includes(card.name)) {
						return false;
					}
					return get.type(card) == "basic";
				}, null, "random");
				if (card) {
					cards.push(card);
					nameList.push(card.name);
				} else {
					break;
				}
			}
			if (!cards.length) {
				return;
			}
			const cards2 = cards;
			await game.cardsGotoOrdering(cards2);
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			event.given_map = {};
			if (!cards2.length) {
				return;
			}
			do {
				const { bool, links } = cards2.length == 1 ? { links: cards2.slice(0), bool: true } : await player.chooseCardButton("饮歌：请选择要分配的牌", true, cards2, [1, cards2.length]).set("ai", () => {
					if (ui.selected.buttons.length == 0) {
						return 1;
					}
					return 0;
				}).forResult();
				if (!bool) {
					return;
				}
				cards2.removeArray(links);
				event.togive = links.slice(0);
				const { targets } = await player.chooseTarget("选择一名角色获得" + get.translation(links), true).set("ai", (target) => {
					const att = get.attitude(_status.event.player, target);
					if (_status.event.enemy) {
						return -att;
					} else if (att > 0) {
						return att / (1 + target.countCards("h"));
					} else {
						return att / 100;
					}
				}).set("enemy", get.value(event.togive[0], player, "raw") < 0).forResult();
				if (targets.length) {
					const id = targets[0].playerid, map = event.given_map;
					if (!map[id]) {
						map[id] = [];
					}
					map[id].addArray(event.togive);
				}
			} while (cards2.length > 0);
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			const list = [];
			for (const i in event.given_map) {
				const source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				player.line(source, "green");
				if (player !== source && (get.mode() !== "identity" || player.identity !== "nei")) {
					player.addExpose(0.2);
				}
				list.push([source, event.given_map[i]]);
			}
			game.loseAsync({
				gain_list: list,
				giver: player,
				animate: "draw"
			}).setContent("gaincardMultiple");
			const evt = event.getParent("phase", true);
			if (evt) {
				game.log(player, "结束了回合");
				evt.num = evt.phaseList.length;
				evt.goto(11);
			}
			player.addTempSkill(event.name + "_effect", "roundStart");
		},
		subSkill: {
			effect: {
				trigger: {
					global: "phaseEnd",
				},
				charlotte: true,
				filter(event, player) {
					return event.player != player && event.player.hasHistory("useCard", evt => evt.effectCount > 1);
				},
				prompt2: "你可以摸一张牌并执行一个额外回合。",
				async content(event, trigger, player) {
					player.draw();
					player.insertPhase();
				},
				mark: true,
				intro: {
					content: "本轮其他角色使用过结算次数大于一的牌的回合结束时，你可以摸一张牌并执行一个额外回合。",
				},
			},
		},
		priority: 10,
	},
	ql_wanling: {
		trigger: {
			global: "roundStart",
			player: ["phaseBegin", "useCard"],
			//source: "damageBegin1",
		},
		forced: true,
		filter(event, player, name) {
			return name != "useCard" || player.countCards("e");
		},
		async content(event, trigger, player) {
			switch (event.triggername) {
				case "roundStart": {
					await player.drawTo(player.maxHp);
					const next = player.insertPhase();
					if (!trigger._finished) {
						trigger.finish();
						trigger._finished = true;
						trigger.untrigger(true);
						trigger._triggered = 5;
						if (!lib.onround.includes(get.info("sm_xianxing").onRound)) {
							lib.onround.push(get.info("sm_xianxing").onRound);
						}
						const evt = trigger.player.insertPhase();
						evt.set("xianxing_phase", true);
						evt.relatedEvent = trigger.relatedEvent || trigger.getParent(2);
						evt.skill = trigger.skill;
						evt._noTurnOver = true;
						evt.set("phaseList", trigger.phaseList);
						evt.pushHandler("xianxing_phase", (event, option) => {
							if (event.step === 0 && option.state === "begin") {
								event.step = 2;
								_status.globalHistory.push({
									cardMove: [],
									custom: [],
									useCard: [],
									changeHp: [],
									everything: [],
								});
								let players = game.players.slice(0).concat(game.dead);
								for (let i = 0; i < players.length; i++) {
									let current = players[i];
									current.actionHistory.push({
										useCard: [],
										respond: [],
										skipped: [],
										lose: [],
										gain: [],
										sourceDamage: [],
										damage: [],
										custom: [],
										useSkill: [],
									});
									current.stat.push({ card: {}, skill: {} });
								}
							}
						});
					}
					const nexts = trigger.getParent()?.next;
					if (nexts?.length) {
						for (let evt of nexts.slice(0)) {
							if (evt.finished) {
								continue;
							}
							if (evt == next) {
								break;
							}
							nexts.remove(evt);
							nexts.push(evt);
						}
					}
				}
					break;
				case "phaseBegin": {
					const list = [];
					for (var i = 1; i < 6; i++) {
						for (var j = 0; j < player.countEnabledSlot(i); j++) {
							if (player.hasEmptySlot(i)) list.push(i);
						}
					}
					if (list.length) await player.disableEquip(list);
					if (!player.isDisabledJudge()) {
						await player.disableJudge();
					}
					await player.recover();
				}
					break;
				default: {
					trigger.baseDamage += player.countCards("e", { type: "equip" });
					//trigger.num += player.countCards("e", { type: "equip" });
				}
					break;
			}
		},
		priority: 9,
	},
	ql_leishang: {
		trigger: {
			global: "useCard1",
		},
		filter(event, player) {
			if (!event.targets?.length) {
				return false;
			}
			return ["basic", "trick"].includes(get.type(event.card));
		},
		async cost(event, trigger, player) {
			const eff = (trigger.targets ?? []).reduce((sum, target) => sum + get.effect(target, trigger.card, player, player), 0);
			event.result = await trigger.player.chooseBool({
				prompt: player === trigger.player ? get.prompt(event.skill) : `是否响应${get.translation(player)}的【${get.translation(event.skill)}】？`,
				prompt2: `令${get.translation(player)}选择恢复一个装备栏并随机装备场上或弃牌堆中一张装备牌，然后${get.translation(trigger.card)}额外结算`,
				ai() {
					return get.event().choice;
				}
			}).set("choice", get.attitude(trigger.player, player) > 0 || eff > 0).forResult();
		},
		async content(event, trigger, player) {
			const num = player.getRoundHistory("useSkill", evt => evt.skill == event.name).length;
			trigger.effectCount += num;
			const result = await player.chooseToEnable().forResult();
			if (result?.control) {
				const cards = [];
				cards.addArray(
					game
						.filterPlayer()
						.map(current => current.getCards("e"))
						.flat()
				);
				cards.addArray(
					Array.from(ui.discardPile.childNodes).filter(card => {
						return get.type(card) === "equip";
					})
				);
				if (cards.length) {
					const card = cards.filter(i => get.subtype(i, false) == result.control && player.canUse(i, player)).randomGet();
					if (card) {
						await player.chooseUseTarget(card, true, "nopopup");
					}
				}
			} else {
				await player.draw(num);
			}
		},
	},
	//果树双管瓶
	ql_shengduan: {
		forced: true,
		trigger: {
			player: "damageBegin4",
		},
		filter(event, player) {
			return game.hasPlayer(target => target != player && !target.getRoundHistory("damage").length);
		},
		async content(event, trigger, player) {
			trigger.cancel();
		},
		ai: {
			nodamage: true,
			skillTagFilter(player, tag, arg) {
				if (!game.hasPlayer(target => target != player && !target.getRoundHistory("damage").length)) {
					return false;
				}
			},
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "damage") && game.hasPlayer(targetx => target != targetx && !targetx.getRoundHistory("damage").length)) {
						return "zeroplayertarget";
					}
				},
			},
		},
		group: ["ql_shengduan_skip", "ql_shengduan_phase"],
		subSkill: {
			skip: {
				trigger: { player: "phaseBeforeStart" },
				filter(event, player) {
					return !event.ql_shengduan_phase;
				},
				prompt2: "摸一张牌并翻面，然后下个回合结束后执行一个回合",
				check: () => true,
				async content(event, trigger, player) {
					await player.draw();
					await player.turnOver();
					player.addSkill("ql_shengduan_insert");
				},
			},
			insert: {
				charlotte: true,
				forced: true,
				trigger: { global: "phaseAfter" },
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					player.insertPhase();
				}
			},
			phase: {
				trigger: {
					global: "roundEnd",
				},
				filter(event, player) {
					const curLen = player.actionHistory.length;
					for (let i = curLen - 1; i >= 0; i--) {
						const history = player.actionHistory[i];
						if (history.isMe && !history.isSkipped) {
							return false;
						}
						if (history.isRound) {
							break;
						}
					}
					return true;
				},
				forced: true,
				async content(event, trigger, player) {
					const next = player.insertPhase();
					next.phaseList = ["phaseUse"];
					next.set(event.name, true);
				},
			}
		}
	},
	ql_wuwei: {
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		locked: false,
		logTarget: () => game.players,
		async content(event, trigger, player) {
			const { targets } = event;
			const list = targets.map(target => target.ql_getCareer());
			if (list.includes("suwei")) {
				await game.doAsyncInOrder(targets, async target => {
					await target.gainMaxHp();
					await target.recover();
				});
				player.addSkill(`${event.name}_handcard`);
				player.addMark(`${event.name}_handcard`, targets.length, false);
			}
			if (list.includes("qingrui")) {
				player.addSkill(`${event.name}_qingrui`);
			}
			if (list.includes("yuanji")) {
				player.addSkill(`${event.name}_yuanji`);
			}
			if (list.includes("goushu")) {
				player.addSkill(`${event.name}_goushu`);
			}
			if (list.includes("zhanlue")) {
				player.addSkill(`${event.name}_zhanlue`);
			}
		},
		subSkill: {
			handcard: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/handcard.png",
				intro: {
					content: "手牌上限+#",
				},
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("ql_wuwei_handcard");
					}
				}
			},
			qingrui: {
				charlotte: true,
				global: "ql_wuwei_qingruiGlobal",
				trigger: {
					global: "useCardAfter",
				},
				filter(event, player) {
					return event.player != player && event.card.name == "sha";
				},
				direct: true,
				async content(event, trigger, player) {
					await player.chooseToUse(get.prompt(event.name).slice(0, -1) + "使用一张牌？",).set("logSkill", event.name);
				}
			},
			qingruiGlobal: {
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + 1;
						}
					}
				}
			},
			yuanji: {
				charlotte: true,
				global: "ql_wuwei_yuanjiGlobal",
				forced: true,
				trigger: {
					global: "useCardToPlayered",
				},
				filter(event, player) {
					return get.distance(event.target, event.player) > 1;
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
			yuanjiGlobal: {
				charlotte: true,
				mod: {
					targetInRange(card, player, target) {
						return true;
					}
				}
			},
			goushu: {
				charlotte: true,
				global: "ql_wuwei_goushuGlobal",
			},
			goushuGlobal: {
				enable: "phaseUse",
				usable: 1,
				filter(event, player) {
					return (
						player.countCards("he") > 0 &&
						game.hasPlayer(target => target != player && target.hasSkill("ql_wuwei_goushu"))
					)
				},
				prompt: "选择一名符合条件的角色，令其观看并获得你一张牌",
				filterTarget(card, player, target) {
					return target != player && target.hasSkill("ql_wuwei_goushu");
				},
				prepare(cards, player, targets) {
					targets[0].logSkill("ql_wuwei", player);
				},
				log: false,
				async content(event, trigger, player) {
					const { target } = event;
					await target.viewHandcards(player);
					await target.gainPlayerCard(player, "he", true, "visible");
					for (let i = 0; i < 2; i++) {
						const card = get.autoViewAs({ name: "wugu", isCard: true, storage: { extraCardsNum: 1 } });
						const targets = [player, target].filter(i => target.canUse(card, i, void 0, false));
						if (targets.length) {
							await target.useCard(targets, card, false);
						} else {
							break;
						}
					}
				},
				ai: {
					order: 7,
					result: {
						target: 1,
					}
				}
			},
			zhanlue: {
				charlotte: true,
				trigger: {
					global: "phaseJieshuBegin",
				},
				filter(event, player) {
					const user = event.player.getPrevious();
					return (
						user?.isIn() &&
						["tao", "sha"].some(name => user.hasCard(card => {
							const vcard = get.autoViewAs({ name }, [card]);
							return lib.filter.targetEnabled2(vcard, user, event.player) && lib.filter.targetInRange(vcard, user, event.player);
						}, "hes"))
					);
				},
				logTarget(event, player) {
					return event.player.getPrevious();
				},
				async cost(event, trigger, player) {
					const target = trigger.player.getPrevious();
					const result = await target
						.chooseButton([
							`###五味###将一张牌当做【杀】或【桃】对${get.translation(trigger.player)}使用`,
							[["sha", "tao"], "vcard"]
						])
						.set("targetx", trigger.player)
						.set("filterButton", button => {
							const { targetx, player } = get.event();
							return player.hasCard(card => {
								const vcard = get.autoViewAs({ name: button.link[2] }, [card]);
								return lib.filter.targetEnabled2(vcard, player, targetx) && lib.filter.targetInRange(vcard, player, targetx);
							}, "hes");
						})
						.set("ai", button => {
							const { targetx, player } = get.event();
							return get.effect(targetx, get.autoViewAs({ name: button.link[2] }, "unsure"), player, player);
						})
						.forResult();
					event.result = {
						bool: result.bool,
						cost_data: result.links?.[0]?.[2],
					}
				},
				async content(event, trigger, player) {
					const { targets: [target], cost_data: name } = event;
					game.broadcastAll(name => {
						lib.skill.ql_wuwei_backup.viewAs = { name };
					}, name)
					const next = target.chooseToUse(true);
					next.set("filterCard", function (card, player) {
						const { skill } = get.event();
						if (skill) {
							const { name } = get.info(skill);
							return lib.filter.cardEnabled(get.autoViewAs({ name }, [card]), player, "forceEnable");
						}
						return lib.filter.filterCard.apply(this, arguments);
					});
					next.set("openskilldialog", "五味：将一张牌当作【" + get.translation(name) + "】对" + get.translation(trigger.player) + "使用");
					next.set("norestore", true);
					next.set("_backupevent", `ql_wuwei_backup`);
					next.set("custom", {
						add: {},
						replace: { window() { } },
					});
					next.backup(`ql_wuwei_backup`);
					next.set("targetRequired", true);
					next.set("complexTarget", true);
					next.set("complexSelect", true);
					next.set("filterTarget", function (card, player, target) {
						const { targetx } = get.event();
						if (target != targetx && !ui.selected.targets.includes(targetx)) {
							return false;
						}
						return lib.filter.targetEnabled2(card, player, targetx) && lib.filter.targetInRange(card, player, targetx);
					});
					next.set("addCount", false);
					next.set("targetx", trigger.player);
					next.set("sourcex", player);
					next.set("oncard", () => {
						const { card } = get.event();
						const { sourcex } = get.event().getParent();
						sourcex
							.when({ global: "useCardAfter" })
							.filter(evt => evt.card == card)
							.then(async (event, trigger, player) => {
								const cards = trigger.cards.filterInD("od");
								if (cards.length) {
									await player.gain(cards, "gain2");
								}
							})
					});
					await next;
				}
			},
			backup: {
				position: "hes",
				selectCard: 1,
				selectTarget: 1,
				check(card) {
					return 6 - get.value(card);
				},
				log: false,
			},
		}
	},
	//铜奔马
	ql_xingkong: {
		enable: "phaseUse",
		usable: 1,
		filterTarget: function (card, player, target) {
			return player != target;
		},
		async content(event, trigger, player) {
			const { target, name } = event;
			const judgeEvent = await target.judge().forResult();
			const { card, suit } = judgeEvent;
			await player.gain(card, "gain2");
			const result2 = await target
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha" || (get.suit(card) != _status.event.suitx && get.suit(card) != "unsure")) {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"行空：对" + get.translation(player) + "使用一张" + get.translation(suit) + "杀，否则你不能使用不指定" + get.translation(player) + "为目标的牌至你的回合结束。"
				)
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("complexTarget", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.filterTarget.apply(this, arguments);
				})
				.set("suitx", suit)
				.set("sourcex", player).forResult();
			if (!result2.bool) {
				target.addTempSkill(name + "_chaofeng", { player: "phaseAfter" });
				const cardUse = get.autoViewAs({ name: "sha", isCard: true });
				if (player.canUse(cardUse, target, false, false)) {
					await player.useCard(cardUse, target, false, false);
				}
			}
			/*game.log(player.getStat().skill.ql_xingkong);
			player.getStat().skill.ql_xingkong--;*/
		},
		subSkill: {
			chaofeng: {
				mod: {
					cardSavable(card, player, target) {
						if (!target.hasSkill("ql_xingkong")) {
							return false;
						}
					},
					playerEnabled(card, player, target) {
						if (!target.hasSkill("ql_xingkong")) {
							return false;
						}
					},
					cardEnabled(card, player, target) {
						if (get.info(card).notarget) {
							return false;
						}
					},
				},
				"skill_id": "ql_xingkong_chaofeng",
				sub: true,
				sourceSkill: "ql_xingkong",
				"_priority": 0,
			},
		},
		ai: {
			order: 10,
			expose: 0.2,
			result: {
				target: -1,
			},
		},
		"skill_id": "ql_xingkong",
		"_priority": 0,
	},
	ql_qiji: {
		trigger: {
			player: ["useCardAfter", "respondAfter"],
		},
		frequent: true,
		filter(event, player) {
			if (!event.respondTo) {
				return false;
			}
			if (player == event.respondTo[0]) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			const { respondTo, player: target } = trigger;
			const result = await target.gainPlayerCard(respondTo[0], "hej").forResult();
			/*game.log(trigger.player);
			game.log(trigger.respondTo[0]);
			game.log(trigger.respondTo[1]);*/
		},
		"skill_id": "ql_qiji",
		"_priority": 0,
	},
	ql_tafeng: {
		marktext: "踏",
		intro: {
			name: "踏风",
			"name2": "踏风",
			markcount: "mark",
			content: "剩余可发动踏风次数：$",
		},
		enable: ["chooseToUse", "chooseToRespond"],
		filter(event, player) {
			if (
				!event.filterCard(get.autoViewAs({ name: "sha", storage: { ql_tafeng: true }, isCard: true }), player, event) &&
				!event.filterCard(get.autoViewAs({ name: "shan", storage: { ql_tafeng: true }, isCard: true }), player, event) &&
				!event.filterCard(get.autoViewAs({ name: "wuxie", storage: { ql_tafeng: true }, isCard: true }), player, event)
			) {
				return false;
			}
			return player.countMark("ql_tafeng");
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				if (event.filterCard(get.autoViewAs({ name: "sha", storage: { ql_tafeng: true }, isCard: true }), player, event)) {
					list.push(["基本", "", "sha"]);
				}
				if (event.filterCard(get.autoViewAs({ name: "shan", storage: { ql_tafeng: true }, isCard: true }), player, event)) {
					list.push(["基本", "", "shan"]);
				}
				if (event.filterCard(get.autoViewAs({ name: "wuxie", storage: { ql_tafeng: true }, isCard: true }), player, event)) {
					list.push(["锦囊", "", "wuxie"]);
				}
				const dialog = ui.create.dialog("踏风", [list, "vcard"]);
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				var player = _status.event.player;
				return _status.event.getParent().type == "phase" ? player.getUseValue({ name: button.link[2] }) : 1;
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
						isCard: true,
						storage: {
							ql_tafeng: true,
						},
						cards: [],
					},
					filterCard: () => false,
					selectCard: -1,
					popname: true,
					log: false,
					async precontent(event, trigger, player) {
						player.logSkill("ql_tafeng");
						event.getParent().addCount = false;
						player.removeMark("ql_tafeng");
					},
					ai1(card) {
						var player = _status.event.player;
						var num = player.countCards("h") - 2 * player.countCards("h", { type: "basic" });
						if (player.hasSkill("starsujin") && Math.abs(num) == 1) {
							if (num == 1 && get.type(card) != "basic") {
								return 15 - get.value(card);
							}
							if (num == -1 && get.type(card) == "basic") {
								return 15 - get.value(card);
							}
						}
						return 7 - get.value(card);
					},
				};
			},
			prompt(links) {
				return "视为使用【" + get.translation(links[0][2]) + "】";
			},
		},
		hiddenCard(player, name) {
			if (name == "wuxie" || name == "shan") {
				return player.countMark("ql_tafeng");
			}
		},
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				if (
					!player.countCards("hs", card => {
						return !player.getStorage("starlifeng_count").includes(get.color(card, player)) || _status.connectMode;
					})
				) {
					return false;
				}
			},
			order: 10,
			result: {
				player: 1,
			},
		},
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.ql_tafeng) {
					return Infinity;
				}
			},
		},
		group: ["ql_tafeng_mark", "ql_tafeng_cancel"],
		subSkill: {
			mark: {
				charlotte: true,
				trigger: {
					global: ["phaseBefore", "phaseEnd"],
					player: "enterGame",
				},
				manualConfirm: true,
				filter(event, player, name) {
					if (name == "phaseEnd") {
						return player.hasHistory("useCard");
					}
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					player.addMark("ql_tafeng");
				},
				"skill_id": "starlifeng_mark",
				sub: true,
				sourceSkill: "starlifeng",
				"_priority": 0,
			},
			cancel: {
				trigger: {
					player: "damageBegin3",
				},
				filter(event, player) {
					return !event.card;
				},
				prompt() {
					return "是否移去一枚敏捷标记防止此伤害";
				},
				async content(event, trigger, player) {
					trigger.cancel();
					player.removeMark("ql_tafeng");
				},
				"skill_id": "ql_tafeng_cancel",
				sub: true,
				sourceSkill: "ql_tafeng",
				"_priority": 0,
			},
		},
		"skill_id": "starlifeng",
	},
	//莲塘乳鸭图
	ql_silv: {
		trigger: {
			global: "phaseJieshuBegin",
		},
		filter(event, player) {
			return game.hasGlobalHistory("cardMove", evt => {
				if (evt.type != "discard" || evt.getlx === false) {
					return false;
				}
				return evt.getd().someInD("d");
			});
		},
		async cost(event, trigger, player) {
			const cards = game.getGlobalHistory("cardMove", evt => {
				if (evt.type != "discard" || evt.getlx === false) {
					return false;
				}
				return evt.getd().someInD("d");
			}).flatMap(evt => evt.getd().filterInD("d"));
			const result = await trigger.player
				.chooseButton([
					`丝缕：是否将任意张因弃置而进入弃牌堆的牌置于${get.translation(player)}的武将牌上`,
					cards
				], [1, cards.length])
				.set("ai", button => {
					const att = get.attitude(get.player(), get.event().getParent().player);
					if (att > 0) {
						return get.buttonValue(button);
					}
					return 0;
				})
				.forResult();
			if (result?.bool) {
				event.result = {
					bool: true,
					cost_data: result.links,
				}
			}
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const { cost_data: cards, targets: [target] } = event;
			const next = player.addToExpansion(cards, "gain2");
			next.gaintag.add(event.name);
			await next;
			const num = player.countExpansions(event.name) - player.countCards("h");
			if (num > 0) {
				const result = await player
					.chooseButton([
						`丝缕：是否摸一张牌并将武将牌上的牌弃至与你手牌相同，然后令其选择获得弃置牌中的两张？`,
						player.getExpansions(event.name)
					], num)
					.set("target", target)
					.set("ai", button => {
						if (get.attitude(get.event().player, get.event().target) > 0) {
							return 6.5 - get.buttonValue(button)
						}
						return 0;
					})
					.forResult();
				if (result?.bool) {
					let { links } = result;
					await player.draw();
					await player.loseToDiscardpile(links);
					links = links.filterInD("d");
					const result2 = await target
						.chooseCardButton("丝缕：请选择获得两张牌", links, Math.min(2, links.length), true)
						.set("direct", true)
						.set("ai", button => get.buttonValue(button))
						.forResult();
					const { links: gain } = result2;
					await target.gain(gain, "gain2");
				}
			}
			if (target.getHp() < player.getHp() && target.isDamaged()) {
				const num = target.getHp();
				let result;
				if (num <= 0) {
					result = await player.chooseBool(`丝缕：是否令${get.translation(target)}回复一点体力`).set("choice", get.recoverEffect(target, player, player) > 0).forResult();
					result.links = [];
				} else {
					result = await player
						.chooseButton([
							`丝缕：是否移去${num}张牌令${get.translation(target)}回复一点体力`,
							player.getExpansions(event.name)
						], num)
						.set("target", target)
						.set("ai", button => {
							const { target, player } = get.event();
							if (get.recoverEffect(target, player, player) > 0) {
								return 6.5 - get.buttonValue(button);
							}
							return 0;
						})
						.forResult();
				}
				if (result?.bool) {
					const { links } = result;
					player.line(target, "green");
					if (links?.length) {
						await player.loseToDiscardpile(links);
					}
					await target.recover();
				}
			}
		},
		intro: {
			markcount: "expansion",
			content: "expansion",
		}
	},
	ql_fulu: {
		forced: true,
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (player.countCards("h")) {
				return false;
			}
			const evt = event.getl(player);
			return evt && evt.hs && evt.hs.length && player.countExpansions("ql_silv");
		},
		async content(event, trigger, player) {
			const cards = player.getExpansions("ql_silv");
			const types = cards.map(card => get.type2(card)).unique();
			let result;
			if (types.length == 1) {
				result = { index: 0 };
			} else {
				result = await player
					.chooseControl(types)
					.set("prompt", "凫鹭：请选择要获得的类型")
					.set("choice", get.rand(0, types.length - 1))
					.forResult();
			}
			const type = types[result.index];
			const gain = cards.filter(card => get.type2(card) == type);
			if (gain.length) {
				await player.gain(gain, "gain2");
			}
		},
		group: ["ql_fulu_damage"],
		subSkill: {
			damage: {
				trigger: {
					player: "damageEnd",
					source: "damageSource",
				},
				logTarget(event, player, name) {
					return name == "damageSource" ? event.player : event.source;
				},
				filter(event, player, name) {
					const target = name == "damageSource" ? event.player : event.source;
					return target.isIn() && target.countCards("hej") > 0;
				},
				async cost(event, trigger, player) {
					const target = event.triggername == "damageSource" ? trigger.player : trigger.source;
					event.result = await player
						.choosePlayerCard(`###${get.prompt(event.skill, target)}###将其区域内一张牌置于你武将牌上`, target, "hej")
						.set("target", target)
						.set("ai", button => {
							const val = get.buttonValue(button);
							if (get.attitude(_status.event.player, get.owner(button.link)) > 0) {
								return -val;
							}
							return val;
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const { targets: [target], cards } = event;
					const next = player.addToExpansion(cards, target, "give");
					next.gaintag.add("ql_silv");
					game.log(player, "将", target, "区域内的", cards, "置于武将牌上");
					await next;
				}
			},
		}
	},
	ql_futao: {
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countDiscardableCards(player, "he") > 0;
		},
		complexCard: true,
		filterCard(card, player) {
			return lib.filter.cardDiscardable(card, player, "ql_futao") && !ui.selected.cards.some(cardx => get.suit(card) == get.suit(cardx));
		},
		check(card) {
			return 7 - get.value(card);
		},
		selectCard: [1, 5],
		position: "he",
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { cards, target } = event;
			const suits = cards.map(i => get.suit(i)).unique();
			let result;
			if (suits.length == 0) {
				result = { bool: false };
			} else {
				result = await target
					.chooseToDiscard(`浮涛：弃置以下花色的牌各一张：${get.translation(suits)}，否则翻面`, suits.length, "he")
					.set("ai", card => 7 - get.value(card))
					.set("complexCard", true)
					.set("filterCard", card => {
						const { suits } = get.event();
						const suit = get.suit(card);
						return suits.includes(suit) && !ui.selected.cards.some(cardx => suit == get.suit(cardx));
					})
					.set("suits", suits)
					.forResult();
			}
			if (!result?.bool) {
				await target.turnOver();
			} else {
				await target.recover();
				await player.recover();
			}
		},
		ai: {
			order: 6,
			result: {
				target(player, target) {
					if (target.isTurnedOver()) {
						return 0;
					}
					return -(114514 - target.countCards("he"));
				}
			}
		}
	},
	//白石散乐
	ql_sanqu: {
		forced: true,
		trigger: {
			player: ["enterGame", "damageEnd"],
			source: "damageSource",
			global: "phaseBefore",
		},
		priority: 10,
		filter(event, player, name) {
			if (event.name == "damage") {
				if (name == "damageSource") {
					return true;
				}
				return game.openZhizhi();
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		getIndex(event, player) {
			return event.name == "damage" ? event.num : 1;
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				player.addMark(event.name);
			} else {
				player.addMark(event.name, 2);
			}
		},
		intro: {
			name: "散曲（曲）",
			name2: "曲",
			markcount: "mark",
			content: "mark",
		},
		mod: {
			maxHandcard(player, num) {
				return num + player.countMark("ql_sanqu");
			}
		}
	},
	ql_pailian: {
		derivation: ["ql_yanchu"],
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			return player.countMark("ql_sanqu") >= 3;
		},
		check: () => true,
		async content(event, trigger, player) {
			player.removeMark("ql_sanqu", 3);
			await player.draw(3);
			await player.turnOver();
			player.addTempSkill("ql_pailian_effect", { player: "phaseUseBegin" });
			player
				.when("phaseUseBegin")
				.then(async (event, trigger, player) => {
					if (player.hasSkill("ql_yanchu", null, false, false)) {
						return;
					}
					await player.addSkills("ql_yanchu");
				})
		},
		ai: {
			combo: "ql_sanqu",
		},
		group: ["ql_pailian_phase"],
		subSkill: {
			effect: {
				charlotte: true,
				forced: true,
				trigger: {
					player: "damageEnd",
				},
				priority: 9,
				getIndex: event => event.num,
				async content(event, trigger, player) {
					const result = await player.judge().forResult();
					if (result.color == "red") {
						await player.recover();
					} else if (result.color == "black") {
						await player.draw();
					}
				},
			},
			phase: {
				forced: true,
				trigger: {
					player: "judgeEnd",
				},
				filter(event, player) {
					if (!game.openZhizhi()) {
						return false;
					}
					const index = game.getAllGlobalHistory("everything", evt => evt.name == "judge" && evt.player == player).indexOf(event) + 1;
					return index > 0 && index % 3 == 0;
				},
				async content(event, trigger, player) {
					game.log(player, "获得了一个额外回合");
					player.insertPhase();
				}
			},
		}
	},
	ql_yanchu: {
		onremove: true,
		mod: {
			targetInRange(card, player) {
				return true;
			}
		},
		trigger: {
			player: ["changeSkillsAfter"],
		},
		filter(event, player) {
			return event.addSkill.includes("ql_yanchu");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(`###${get.prompt(event.skill)}###对至多两名角色各造成一点火焰伤害并摸两张牌`, [1, 2])
				.set("ai", target => get.damageEffect(target, get.player(), get.player(), "fire"))
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			await game.doAsyncInOrder(targets, async target => target.damage("fire"));
			await player.draw(2);
		},
		group: ["ql_yanchu_remove", "ql_yanchu_zhizhi", "ql_yanchu_useCard"],
		subSkill: {
			useCard: {
				forced: true,
				trigger: {
					player: "useCard",
				},
				filter(event, player) {
					const suit = get.suit(event.card);
					return lib.suit.includes(suit) && !player.getStorage("ql_yanchu_used").includes(suit);
				},
				async content(event, trigger, player) {
					const suit = get.suit(trigger.card);
					player.addTempSkill("ql_yanchu_used");
					player.markAuto("ql_yanchu_used", suit);
					switch (suit) {
						case "spade": {
							const result = await player
								.chooseTarget("演出：令一名其他角色失去体力", lib.filter.notMe)
								.set("ai", target => get.effect(target, { name: "losehp" }, get.player(), get.player()))
								.forResult();
							if (result.bool) {
								const { targets } = result;
								player.line(targets, "yellow");
								await targets[0].loseHp();
							}
							break;
						}
						case "club": {
							const result = await player
								.chooseTarget("演出：获得一名角色区域内一张牌")
								.set("ai", target => get.effect(target, { name: "shunshou_copy" }, get.player(), get.player()))
								.forResult();
							if (result.bool) {
								const { targets } = result;
								player.line(targets, "yellow");
								await player.gainPlayerCard(targets[0], "hej", true);
							}
							break;
						}
						case "diamond": {
							await player.draw(2);
							break;
						}
						case "heart": {
							await player.recover();
							break;
						}
					}
				}
			},
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已触发：$"
				}
			},
			remove: {
				forced: true,
				trigger: {
					player: "phaseUseEnd",
				},
				filter(event, player) {
					return !player.storage.ql_yanchu;
				},
				async content(event, trigger, player) {
					await player.removeSkills("ql_yanchu");
				}
			},
			zhizhi: {
				forced: true,
				trigger: {
					player: "phaseUseBegin",
				},
				filter(event, player) {
					return game.openZhizhi();
				},
				async content(event, trigger, player) {
					const cards = [];
					const canUse = card => player.hasUseTarget(card, true, true) || (get.info(card).notarget && lib.filter.cardEnabled(card, player));
					for (const suit of lib.suit) {
						const card = get.cardPile(card => get.suit(card) == suit && canUse(card));
						if (card) {
							cards.push(card);
						}
					}
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				}
			}
		}
	},
	ql_shengyue: {
		trigger: {
			global: "phaseJieshuBegin",
		},
		filter(event, player) {
			return event.player != player && player.countMark("ql_sanqu") >= (game.countPlayer() * 5);
		},
		skillAnimation: true,
		animationColor: "thunder",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => get.attitude(get.player(), target))
				.forResult();
		},
		async content(event, trigger, player) {
			player.clearMark("ql_sanqu");
			const { targets: [target] } = event;
			player.line(target, "yellow");
			await target.die();
			await player.removeSkills("ql_sanqu");
			player.setStorage("ql_yanchu", true);
			await player.addSkills(["ql_yanchu", "ql_pailian_effect"]);
		}
	},
	//慧
	hb_luokuan: {
		forced: true,
		intro: {
			name: "落款",
			name2: "落",
			markcount: "mark",
			content: "mark",
		},
		trigger: {
			source: "damageSource",
			player: "phaseEnd",
		},
		filter(event, player) {
			if (event.name == "damage") {
				return event.num > 0 && event.hasNature() && event.player != player;
			}
			return game.hasPlayer(target => target.hasMark("hb_luokuan"));
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				trigger.player.addMark(event.name, 1);
				return;
			}
			for (let target of game.players.slice(0).sortBySeat()) {
				const num = target.countMark(event.name);
				if (num > target.hp) {
					await target.damage();
				}
				target.clearMark(event.name);
			}
		},
	},
	hb_zaie: {
		enable: "phaseUse",
		usable: 1,
		map: {
			fire: "对一名血量大于你的角色造成一点火焰伤害",
			thunder: "弃置一名血量为1或翻面的角色一张牌并对其造成一点雷电伤害",
			mark: "令两名角色各获得一个“落款”标记。",
		},
		chooseButton: {
			dialog(event, player) {
				const skill = "hb_zaie";
				const { map } = get.info(skill);
				const list = Object.keys(map).map(key => [key, map[key]]);
				return ui.create.dialog("###灾厄###", [list, "tdnodes"], "hidden");
			},
			filter(button) {
				const player = get.player();
				if (button.link == "fire" && player.isMaxHp()) {
					return false;
				}
				if (button.link == "thunder" && !game.hasPlayer(c => c.hp == 1 || c.isTurnedOver())) {
					return false;
				}
				return true;
			},
			backup(links, player) {
				return {
					filterTarget(card, player, target) {
						return links[0] === 'fire' ? target.hp > player.hp :
							links[0] === 'thunder' ? target.hp === 1 || target.isTurnedOver() :
								links[0] === 'mark' ? true : false;
					},
					selectTarget:
						links[0] === 'fire' ? 1 :
							links[0] === 'thunder' ? 1 :
								links[0] === 'mark' ? [1, 2] : null,
					multiline: true,
					multitarget: true,
					link: links[0],
					async content(event, trigger, player) {
						const skill = "hb_zaie";
						const { targets } = event;
						const { link } = get.info(event.name);
						switch (link) {
							case "fire": await targets[0].damage("fire"); break;
							case "thunder": await player.discardPlayerCard(targets[0], "he");
								await targets[0].damage("thunder"); break;
							case "mark": if (targets[0]) targets[0].addMark("hb_luokuan");
								if (targets[1]) targets[1].addMark("hb_luokuan"); break;
							default: player.chat("意料之外的结果"); break;
						}
					},
				}
			},
		},
	},
	hb_jingan: {
		enable: "phaseUse",
		usable: 1,
		map: {
			range: "令一名角色使用牌无距离限制至其回合结束",
			hujia: "令一名角色和你各获得一点护甲",
			damage: "下一张牌指定的角色中令至多三名角色各获得一个“落款”",
		},
		chooseButton: {
			dialog(event, player) {
				const skill = "hb_jingan";
				const { map } = get.info(skill);
				const list = Object.keys(map).map(key => [key, map[key]]);
				return ui.create.dialog("###靖安###", [list, "tdnodes"], "hidden");
			},
			backup(links, player) {
				return {
					filterTarget: true,
					selectTarget: links[0] === 'damage' ? 0 : 1,
					multiline: true,
					multitarget: true,
					link: links[0],
					async content(event, trigger, player) {
						const skill = "hb_jingan";
						const { targets } = event;
						const { link } = get.info(event.name);
						switch (link) {
							case "range": await targets[0].addTempSkill(skill + "_range", { player: "phaseEnd" }); break;
							case "hujia": await game.doAsyncInOrder([player, targets[0]], async target => target.changeHujia(1)); break;
							case "damage":
								player.when({ player: "useCardToPlayered", })
									.filter(evt => evt.targets.length)
									.step(async (event, trigger, player) => {
										const result = await player.chooseTarget()
											.set("filterTarget", function (card, player, target) {
												return get.event().targets.includes(target)
											})
											.set("targets", trigger.targets)
											.set("selectTarget", [1, 3])
											.forResult();
										if (result.bool) {
											for (let p of result.targets) {
												p.addMark("hb_luokuan");
											}
										}
									})
								/*player
									.when({ source: "damageBegin2", })
									.filter(evt => { game.log(); return evt.card })
									.step(async (event, trigger, player) => {
										trigger.cancel();
										trigger.player.damage("fire", trigger.num, trigger.cards);
										await player.draw();
									});*/
								break;
							default: player.chat("意料之外的结果"); break;
						}
					},
				}
			},
		},
		subSkill: {
			range: {
				mod: {
					targetInRange(card, player) {
						return true;
					}
				},
			},
		},
	},
	hb_moran: {
		enable: "phaseUse",
		usable: 1,
		map: {
			target: "其下回合使用牌不能指定你为目标",
			wuqian: "翻面或不能响应你的牌直到回合结束",
			link: "其和其上家或下家横置。",
		},
		chooseButton: {
			dialog(event, player) {
				const skill = "hb_moran";
				const { map } = get.info(skill);
				const list = Object.keys(map).map(key => [key, map[key]]);
				return ui.create.dialog("###墨染###", [list, "tdnodes"], "hidden");
			},
			backup(links, player) {
				return {
					filterTarget(card, player, target) {
						return links[0] === 'link' ? ui.selected.targets.every(current => target == current.getNext() || target == current.getPrevious()) : true;
					},
					selectTarget: links[0] === 'link' ? 2 : 1,
					multiline: true,
					multitarget: true,
					link: links[0],
					async content(event, trigger, player) {
						const skill = "hb_moran";
						const { targets } = event;
						const { link } = get.info(event.name);
						switch (link) {
							case "target": targets[0]
								.when({ player: "phaseBegin", })
								.step(async (event, trigger, player) => {
									player.addTempSkill("hb_moran_effect", { global: "roundStart" });
								}); break;
							case "wuqian":
								const result = await targets[0].chooseBool(`不能响应${get.translation(player)}的牌直到回合结束或点取消翻面`).forResult();
								if (result.bool) {
									player.addTempSkill(skill + "_fuqi");
									player.markAuto(skill + "_fuqi", targets[0]);
								} else {
									await targets[0].turnOver();
								} break;
							case "link": await game.doAsyncInOrder(targets, async target => target.link(true)); break;
							default: player.chat("意料之外的结果"); break;
						}
					},
				}
			},
		},
		subSkill: {
			fuqi: {
				intro: {
					content: "$不能响应你的牌",
				},
				trigger: {
					player: "useCard",
				},
				charlotte: true,
				forced: true,
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.filterPlayer(current => player.getStorage(event.name).includes(current)));
				},
			},
			effect: {
				mod: {
					playerEnabled(card, player, target) {
						if (target.hasSkill("hb_moran")) {
							return false;
						}
					},
				},
			},
		},
	},
	hb_fenxin: {
		limited: true,
		enable: "phaseUse",
		skillAnimation: true,
		animationColor: "metal",
		manualConfirm: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.addTempSkill("hb_fenxin_effect");
		},
		subSkill: {
			effect: {
				trigger: {
					source: "damageSource",
				},
				filter(event, player) {
					if (event?.hb_fenxin_effect) return false;
					return event.player.countMark("hb_luokuan");
				},
				prompt2(event, player) {
					const list = [event.player.getNext(), event.player.getPrevious()];
					return `是否对${get.translation(list)}各造成一点伤害。`;
				},
				async content(event, trigger, player) {
					const list = [trigger.player.getNext(), trigger.player.getPrevious()];
					await game.doAsyncInOrder(list, async target => target.damage());
				},
			},
		},
	},
	//兔妈
	ql_yixing: {
		enable: "phaseUse",
		intro: {
			markcount: (storage, player, skill) => storage.length,
			content(storage, player, skill) {
				return `<li>已记录花色：${get.translation(storage)}<br><li>已移去选项：${player.getStorage(`${skill}_remove`).map(i => get.info(skill).map[i]).join("、")}`;
			},
		},
		filter(event, player) {
			return !player.getStorage("ql_yixing").containsAll(...lib.suit.slice());
		},
		map: {
			h: "手牌",
			e: "装备牌",
			j: "判定牌",
			seat: "座位",
			hp: "体力值",
		},
		chooseButton: {
			dialog(event, player) {
				const skill = "ql_yixing";
				const removed = player.getStorage(`${skill}_remove`);
				const { map } = get.info(skill);
				const list = Object.keys(map).removeArray(removed);
				return ui.create.dialog("###移形###请选择要交换的选项", [list.map(i => [i, map[i]]), "tdnodes"], "hidden");
			},
			backup(links, player) {
				return {
					filterTarget: true,
					selectTarget: 2,
					multiline: true,
					multitarget: true,
					link: links[0],
					async content(event, trigger, player) {
						const skill = "ql_yixing";
						const { targets } = event;
						const [targetx, targety] = targets;
						const { link } = get.info(event.name);
						player.markAuto(`${skill}_remove`, link);
						if (link == "h") {
							await targetx.swapHandcards(targety);
						}
						if (link == "e") {
							await targetx.swapEquip(targety);
						}
						if (link == "j") {
							const cards = [targetx.getCards("j"), targety.getCards("j")];
							await game
								.loseAsync({
									player: targetx,
									target: targety,
									cards1: cards[0],
									cards2: cards[1],
								})
								.setContent("swapHandcardsx");
							for (const card of cards[1]) {
								const vcard = card[card.cardSymbol];
								if (vcard.cards?.length && vcard.cards.some(i => get.position(i, true) !== "o")) {
									continue;
								}
								if (!targetx.canAddJudge(vcard)) {
									continue;
								}
								await targetx.addJudge(vcard);
							}
							for (const card of cards[0]) {
								const vcard = card[card.cardSymbol];
								if (vcard.cards?.length && vcard.cards.some(i => get.position(i, true) !== "o")) {
									continue;
								}
								if (!targety.canAddJudge(vcard)) {
									continue;
								}
								await targety.addJudge(vcard);
							}
						}
						if (link == "seat") {
							game.broadcastAll((player, target) => {
								game.swapSeat(player, target);
							}, targetx, targety)
						}
						if (link == "hp") {
							const num = Math.abs(targetx.getHp() - targety.getHp());
							const list = targety.getHp() > targetx.getHp() ? [num, -num] : [-num, num];
							await targetx.changeHp(list[0]);
							await targety.changeHp(list[1]);
							/*await targetx[list[0] > 0 ? "recover" : "loseHp"](Math.abs(list[0]));
							await targety[list[1] > 0 ? "recover" : "loseHp"](Math.abs(list[1]));*/
						}
						const record = player.getStorage(skill);
						const list = lib.suit.slice().removeArray(record);
						const result = await player.chooseControl(list).set("prompt", "请记录一个花色").forResult();
						const suit = result.control;
						player.markAuto(skill, suit);
						if (link == "hp") {
							const result = await player.chooseTarget(`移形：选择一名角色与其计算其他角色距离-1`, lib.filter.notMe, true).forResult();
							const { targets } = result;
							if (targets?.length) {
								player.line(targets);
								[player, ...targets].forEach(i => {
									i.addMark(`${skill}_dist`, 1, false);
									i.addSkill(`${skill}_dist`);
								})
							}
						}
						if (link == "seat") {
							const result = await player
								.chooseTarget(`移形：对其中一个被交换的角色的上下家各造成一点伤害`, (card, player, target) => get.event().targets.includes(target), true)
								.set("targets", targets)
								.forResult();
							const { targets: targetsx } = result;
							if (targetsx?.length) {
								const damage = [targetsx[0].getNext(), targetsx[0].getPrevious()];
								player.line(damage);
								await game.doAsyncInOrder(damage, async target => target.damage());
							}
						}
						if (!["hp", "seat"].includes(link)) {
							const result = await player.chooseTarget(`移形：令一名角色摸两张牌且使用的下一张【杀】无次数限制且额外结算一次。`, true).forResult();
							const { targets } = result;
							if (targets?.length) {
								player.line(targets);
								await targets[0].draw(2);
								targets[0].addSkill(`${skill}_sha`);
							}
						}
					}
				}
			},
			prompt(links, player) {
				const link = links[0];
				const skill = "ql_yixing";
				const { map } = get.info(skill);
				return `你可以交换两名角色的${map[link]}`;
			}
		},
		subSkill: {
			backup: {},
			dist: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "计算与其他角色距离-#",
				},
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("ql_yixing_dist");
					},
					globalFrom(from, to, num) {
						return num - from.countMark("ql_yixing_dist");
					},
				}
			},
			sha: {
				charlotte: true,
				mod: {
					cardUsable: (card, player) => {
						if (card.name == "sha") {
							return Infinity;
						}
					},
				},
				trigger: {
					player: "useCard1",
				},
				forced: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					return event.card.name == "sha";
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] == "number") {
							stat[name]--;
						}
					}
					trigger.effectCount++;
				},
				mark: true,
				intro: {
					content: "使用的下一张【杀】无任何次数限制且额外结算一次",
				},
			},
		}
	},
	ql_tongyao: {
		forced: true,
		trigger: {
			player: "damageBegin4",
		},
		async content(event, trigger, player) {
			const next = player.judge();
			next.set("callback", async event => {
				if (get.position(event.judgeResult.card, true) == "o") {
					await player.gain(event.judgeResult.card, "gain2");
				}
			});
			const result = await next.forResult();
			if (player.getStorage("ql_yixing").includes(result.suit)) {
				trigger.cancel();
				player.unmarkAuto("ql_yixing", result.suit);
				const { map } = get.info("ql_yixing");
				const list = player.getStorage("ql_yixing_remove");
				const resultx = await player
					.chooseButton([
						`童谣：请选择要恢复的选项`,
						[list.map(i => [i, map[i]]), "tdnodes"]
					], true)
					.forResult();
				const { links } = resultx;
				if (links?.length) {
					player.unmarkAuto("ql_yixing_remove", links[0]);
				}
			}
		},
		ai: {
			combo: "ql_yixing",
		}
	},
	//曹髦
	ql_hongfa: {
		enable: "phaseUse",
		filter(event, player) {
			return (
				player.countCards("h") &&
				player.countCards("h", { color: "red" }) != player.countCards("h", { color: "black" })
			)
		},
		async content(event, trigger, player) {
			await player.showHandcards();
			const num = Math.abs(player.countCards("h", { color: "red" }) - player.countCards("h", { color: "black" }));
			const result = await player
				.chooseControl()
				.set("choiceList", [
					`展示一名其他角色手牌，然后失去一点体力视为对其使用至多X张不同的普通锦囊牌（X为你与其对应颜色手牌差的和）`,
					`获得颜色较少的颜色的牌直到两种颜色手牌数相等`
				])
				.set("choice", num > 1 || player.getHp() <= 1 ? 1 : 0)
				.forResult();
			const { index } = result;
			if (typeof index == "number") {
				if (index == 0) {
					await player.loseHp();
					const result2 = await player
						.chooseTarget(`宏伐：请选择一名其他角色作为使用锦囊牌的目标`, true, lib.filter.notMe)
						.set("ai", target => -get.attitude(get.player(), target) * Math.random())
						.forResult();
					const { targets } = result2;
					if (targets?.length) {
						const [target] = targets;
						player.line(target, "yellow");
						await target.showHandcards();
						let num = ["black", "red"].reduce((sum, color) => sum + Math.abs(player.countCards("h", { color: color }) - target.countCards("h", { color: color })), 0);
						const names = [];
						while (num > 0 && target.isIn()) {
							num--;
							const list = get.inpileVCardList(info => {
								if (info[0] != "trick") {
									return false;
								}
								return !names.includes(info[2]) && player.canUse({ name: info[2], isCard: true }, target, false, false);
							});
							if (list.length) {
								const result3 = await player
									.chooseButton([
										`宏伐：请选择要对${get.translation(target)}使用的牌`,
										[list, "vcard"]
									])
									.set("target", target)
									.set("ai", button => get.effect(get.event().target, { name: button.link[2], isCard: true }, get.player(), get.player()))
									.forResult();
								if (result3.bool) {
									const { links: [info] } = result3;
									names.push(info[2]);
									await player.useCard(get.autoViewAs({ name: info[2], isCard: true }), target, false);
								} else {
									break;
								}
							} else {
								break;
							}
						}
					}
				}
				if (index == 1) {
					while (player.countCards("h", { color: "red" }) != player.countCards("h", { color: "black" })) {
						const color = player.countCards("h", { color: "red" }) > player.countCards("h", { color: "black" }) ? "black" : "red";
						const card = get.cardPile(card => get.color(card) == color);
						if (card) {
							await player.gain(card, "gain2");
						} else {
							break;
						}
					}
				}
			}
		},
		ai: {
			order: 5,
			result: {
				player: 1,
			}
		}
	},
	ql_fulong: {
		derivation: ["ql_juetao"],
		trigger: {
			player: "damageEnd",
		},
		filter(event, player) {
			return event.source?.isIn() && player.isDamaged();
		},
		logTarget: "source",
		check(event, player) {
			const target = event.source;
			return get.effect(target, { name: "guohe_copy2" }, player, player) > 0;
		},
		async content(event, trigger, player) {
			const { targets: [target] } = event;
			//await player.viewHandcards(target);
			const num = player.getDamagedHp();
			await player.discardPlayerCard(target, "he", num, true, "visible");
			await player.draw(num);
			const card = get.autoViewAs({ name: "sha", isCard: true });
			if (!player.canUse(card, target, false, false)) {
				return;
			}
			const result = await player
				.chooseBool(`缚龙：是否视为对${get.translation(target)}使用一张额外结算${num}次的【杀】并失去该技能获得〖决讨〗`)
				.set("choice", get.effect(target, { name: "guohe_copy2" }, player, player) > 0)
				.forResult();
			if (result.bool) {
				await player.useCard(card, target, false).set("oncard", () => get.event().effectCount += get.event().num).set("num", num);
				player.changeSkin(event.name, "ql_caomao_shadow");
				await player.changeSkills(get.info(event.name).derivation, [event.name]);
			}
		}
	},
	ql_juetao: {
		trigger: {
			player: "changeHpAfter",
		},
		filter(event, player) {
			return player.isDamaged();
		},
		check: () => true,
		async content(event, trigger, player) {
			await player.chooseToGuanxing(player.getDamagedHp());
			let num = 1;
			if (player.isMaxHandcard()) {
				num++;
			}
			await player.draw(num, "nodelay");
			await player.draw(num, "bottom");
		}
	},
	ql_dengzhu: {
		zhuSkill: true,
		forced: true,
		mod: {
			maxHandcardBase(player, num) {
				return player.maxHp;
			}
		},
		trigger: {
			global: "recoverBefore",
		},
		filter(event, player) {
			return player.getHp() == 1;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.cancel();
		},
		global: "ql_dengzhu_global",
		subSkill: {
			global: {
				mod: {
					cardEnabled(card, player) {
						if (get.name(card) == "shan" && game.hasPlayer(target => target.hasSkill("ql_dengzhu") && target.getHp() == 1)) {
							return false;
						}
					}
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (game.hasPlayer(target => target.hasSkill("ql_dengzhu") && target.getHp() == 1) && get.tag(card, "recover")) {
								return "zeroplayertarget";
							}
						},
					},
				},
			}
		}
	},
	//奎桑提
	ql_xuemeng: {
		trigger: { player: "damageBegin3" },
		forced: true,
		filter(event, player) {
			return game.getGlobalHistory("everything", evt => evt.name == "damage" && evt.player == player).indexOf(event) == 0;
		},
		async content(event, trigger, player) {
			trigger.num--;
			event.set(event.name, true);
			player.addTempSkill(`${event.name}_effect`);
		},
		subSkill: {
			effect: {
				charlotte: true,
				forced: true,
				mark: true,
				intro: {
					content: "造成或受到的伤害+1",
				},
				trigger: {
					source: "damageBegin1",
					player: "damageBegin3",
				},
				filter(event, player) {
					return !event.ql_xuemeng;
				},
				async content(event, trigger, player) {
					trigger.num++;
				}
			}
		},
	},
	ql_tuofu: {
		enable: "phaseUse",
		viewAsFilter(player) {
			return player.countCards("hes") > 0;
		},
		position: "hes",
		filterCard: true,
		selectCard: [1, Infinity],
		filterTarget(card, player, target) {
			if (player != target) {
				return lib.filter.filterTarget(card, player, target);
			}
			if (lib.filter.targetEnabled(card, player, target)) {
				return true;
			}

			if (game.checkMod(card, player, target, "unchanged", "playerEnabled", player) == false) {
				return false;
			}
			if (game.checkMod(card, player, target, "unchanged", "targetEnabled", target) == false) {
				return false;
			}
			return true;
		},
		selectTarget() {
			return ui.selected.cards?.length || 0;
		},
		viewAs(cards, player) {
			return {
				name: "nanman",
				storage: {
					ql_tuofu: player,
				},
			}
		},
		log: false,
		async precontent(event, trigger, player) {
			const skill = event.name.slice(4);
			player.logSkill(skill);
			player.addTempSkill(`${skill}_draw`);
			player.addTempSkill(`${skill}_effect`);
		},
		ai: {//以下直接复制的南蛮ai
			basic: {
				order: 7.2,
				useful: [5, 1],
				value: 5,
			},
			result: {
				player(player, target) {
					if (player._nanman_temp || player.hasSkillTag("jueqing", false, target)) {
						return 0;
					}
					if (target.hp > 2 || (target.hp > 1 && !target.isZhu && target !== game.boss && target !== game.trueZhu && target !== game.falseZhu)) {
						return 0;
					}
					player._nanman_temp = true;
					let eff = get.effect(target, new lib.element.VCard({ name: "nanman" }), player, target);
					delete player._nanman_temp;
					if (eff >= 0) {
						return 0;
					}
					if (target.hp > 1 && target.hasSkillTag("respondSha", true, "respond", true)) {
						return 0;
					}
					let known = target.getKnownCards(player);
					if (
						known.some(card => {
							let name = get.name(card, target);
							if (name === "sha" || name === "hufu" || name === "yuchanqian") {
								return lib.filter.cardRespondable(card, target);
							}
							if (name === "wuxie") {
								return lib.filter.cardEnabled(card, target, "forceEnable");
							}
						})
					) {
						return 0;
					}
					if (target.hp > 1 || target.countCards("hs", i => !known.includes(i)) > 4.67 - (2 * target.hp) / target.maxHp) {
						return 0;
					}
					let res = 0,
						att = get.sgnAttitude(player, target);
					res -= att * (0.8 * target.countCards("hs") + 0.6 * target.countCards("e") + 3.6);
					if (get.mode() === "identity" && target.identity === "fan") {
						res += 2.4;
					}
					if ((get.mode() === "guozhan" && player.identity !== "ye" && player.identity === target.identity) || (get.mode() === "identity" && player.identity === "zhu" && (target.identity === "zhong" || target.identity === "mingzhong"))) {
						res -= 0.8 * player.countCards("he");
					}
					return res;
				},
				target(player, target) {
					let zhu = (get.mode() === "identity" && target.isZhu) || target.identity === "zhu";
					if (!lib.filter.cardRespondable({ name: "sha" }, target)) {
						if (zhu) {
							if (target.hp < 2) {
								return -99;
							}
							if (target.hp === 2) {
								return -3.6;
							}
						}
						return -2;
					}
					let known = target.getKnownCards(player);
					if (
						known.some(card => {
							let name = get.name(card, target);
							if (name === "sha" || name === "hufu" || name === "yuchanqian") {
								return lib.filter.cardRespondable(card, target);
							}
							if (name === "wuxie") {
								return lib.filter.cardEnabled(card, target, "forceEnable");
							}
						})
					) {
						return -1.2;
					}
					let nh = target.countCards("hs", i => !known.includes(i));
					if (zhu && target.hp <= 1) {
						if (nh === 0) {
							return -99;
						}
						if (nh === 1) {
							return -60;
						}
						if (nh === 2) {
							return -36;
						}
						if (nh === 3) {
							return -12;
						}
						if (nh === 4) {
							return -8;
						}
						return -5;
					}
					if (target.hasSkillTag("respondSha", true, "respond", true)) {
						return -1.35;
					}
					if (!nh) {
						return -2;
					}
					if (nh === 1) {
						return -1.8;
					}
					return -1.5;
				},
			},
			tag: {
				respond: 1,
				respondSha: 1,
				damage: 1,
				multitarget: 1,
				multineg: 1,
			},
		},
		subSkill: {
			draw: {
				charlotte: true,
				trigger: {
					global: "useCardToAfter",
				},
				prompt2: "摸一张牌",
				filter(event, player) {
					return (
						event.card?.storage?.ql_tuofu == player &&
						!event.target.hasHistory("damage", evt => evt.getParent() == event && evt.num > 0) &&
						!event.target.hasHistory("respond", evt => evt.card.name == "sha" && evt.respondTo[1] == event.card && evt.getParent("nanman", true) == event)
					);
				},
				async content(event, trigger, player) {
					trigger.getParent().set(event.name, true);
					await player.draw();
				}
			},
			effect: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: {
					player: "useCardAfter",
				},
				filter(event, player) {
					return event.card?.storage?.ql_tuofu == player;
				},
				async content(event, trigger, player) {
					if (trigger.ql_tuofu_draw) {
						player.tempBanSkill("ql_tuofu");
					}
					if (!trigger.ql_tuofu_directHit && game.hasPlayer2(target => target.hasHistory("damage", evt => evt.card == trigger.card), true)) {
						player.addTempSkill("ql_tuofu_directHit", { player: "dieAfter" });
					}
				}
			},
			directHit: {
				charlotte: true,
				trigger: { player: "useCard" },
				filter(event, player) {
					return event.card?.storage?.ql_tuofu == player;
				},
				async cost(event, trigger, player) {
					player.removeSkill(event.skill);
					event.result = await player.chooseBool(`陀斧：是否令${get.translation(trigger.card)}不可被响应，然后令其中一个目标向你移动一个座次`).set("choice", true).forResult();
				},
				async content(event, trigger, player) {
					game.log(trigger.card, "不可被响应");
					trigger.directHit.addArray(game.players);
					const canMove = trigger.targets.slice().removeArray([player.getPrevious(), player.getNext(), player]);
					if (canMove.length) {
						let result;
						canMove.length == 1
							? { bool: true, taragets: canMove }
							: result = await player
								.chooseTarget(`陀斧：令其中一个目标向你移动一个座次`, true, (card, player, target) => get.event().targets.includes(target))
								.set("targets", canMove)
								.set("ai", target => -get.attitude(get.player(), target))
								.forResult();
						const { targets } = result;
						if (targets?.length) {
							const [target] = targets;
							player.line(target);
							const targetsx = [target.previousSeat, target.nextSeat];
							let prev = target, next = target;
							let targetx;
							while (true) {
								prev = prev.previousSeat;
								next = next.nextSeat;
								if ([prev, next].includes(player)) {
									if (prev == next) {
										targetx = targetsx.randomGet();
									} else if (prev == player) {
										targetx = targetsx[0];
									} else {
										targetx = targetsx[1];
									}
									break;
								}
							}
							if (targetx) {
								game.broadcastAll((player, target) => {
									game.swapSeat(player, target);
								}, target, targetx);
							}
						}
					}
				},
			}
		},
	},
	ql_aoang: {
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			return (
				event.player != player &&
				event.player.getAllHistory("damage", evt => evt.source == player).reduce((sum, evt) => sum + evt.num, 0) >= player.getHp() &&
				[player.getNext(), player.getPrevious()].includes(event.player)
			);
		},
		logTarget: "player",
		check: (event, player) => get.attitude(player, event.player) < 0,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const { targets: [target] } = event;
			for (const phase of lib.phaseName) {
				const evt = event.getParent(phase);
				if (evt?.name === phase && !evt.finished && evt.player == target) {
					//不触发cancelled时机
					evt.cancel(true, null, true);
					break;
				}
			}
			const evt = trigger.getParent("phase", true);
			if (evt.player == target) {
				evt.finish();
				const evtx = evt.getParent("phaseLoop", true);
				if (!evt.skill && evtx) {
					evtx.player = evt.player.previousSeat;
				}
			}
			const animate = (player) => {
				return player.animate([
					// 初始状态
					{ transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
					// 中间剧烈抖动一下，增加冲击感
					{ transform: 'translate(-10px, 10px) rotate(-10deg) scale(1.1)', offset: 0.1 },
					// 最终状态：飞出屏幕，缩小并旋转
					{ transform: 'translate(500px, -500px) rotate(720deg) scale(0)', opacity: 0 }
				], {
					duration: 800,
					easing: 'ease-in',
					fill: 'forwards'
				}).finished;
			}
			game.log(target, "被", player, "从游戏中踢出");
			await player.ql_removePlayer(target, { animate });
		}
	},
	//厄斐琉斯
	ql_yening: {
		trigger: {
			global: "phaseJieshuBegin",
		},
		forced: true,
		persevereSkill: true,
		filter(event, player) {
			return player.getHistory("lose", evt => evt.cards2?.length).length;
		},
		async content(event, trigger, player) {
			await player.draw();
			const card = player.getStorage("ql_yening").find(card => get.itemtype(card) == "card");
			switch (card.name) {
				case "ql_tongbi": {
					const wanjian = get.autoViewAs({ name: "wanjian", isCard: true });
					if (player.hasUseTarget(wanjian)) {
						await player.chooseUseTarget(wanjian);
					}
					break;
				}
				case "ql_duanpo": {
					const result = await player
						.chooseTarget("是否对一名其他角色使用随机三张伤害类牌？", lib.filter.notMe)
						.set("ai", target => {
							return get.damageEffect(target, get.player(), get.player())
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						const target = result.targets[0];
						player.line(target);
						const cards = get.inpileVCardList(info => {
							if (info[0] == "delay") {
								return false;
							}
							const vcard = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
							return get.tag(vcard, "damage") && player.canUse(vcard, target, false);
						});
						let num = 0;
						while (cards.length) {
							num++;
							const info = cards.randomRemove(),
								vcard = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
							if (player.canUse(vcard, target, false)) {
								await player.useCard(vcard, target, false);
							}
							if (num >= 3) {
								break;
							}
						}
					}
					break;
				}
				case "ql_zhuiming": {
					const result = await player
						.chooseTarget("是否对至多三名连续座次的角色各造成1点伤害？", [1, 3])
						.set("filterTarget", (card, player, target) => {
							if (!ui.selected.targets.length) {
								return true;
							}
							return ui.selected.targets.some(current => target == current.getNext() || target == current.getPrevious());
						})
						.set("complexTarget", true)
						.set("ai", target => {
							return get.damageEffect(target, get.player(), get.player());
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						const func = async target => await target.damage(player);
						player.line(result.targets);
						await game.doAsyncInOrder(result.targets, func);
					}
					break;
				}
			}
		},
		mod: {
			cardEnabled(card, player) {
				const equips = player.getStorage("ql_yening");
				if (!equips.length) {
					return;
				}
				const cards = [card];
				if (Array.isArray(card?.cards)) {
					cards.addArray(card.cards);
				}
				if (cards.length && cards.containsSome(...equips)) {
					return false;
				}
			},
			cardSavable(card, player) {
				return lib.skill.ql_yening.mod.cardEnabled.apply(this, arguments);
			},
			cardRespondable(card, player) {
				return lib.skill.ql_yening.mod.cardEnabled.apply(this, arguments);
			},
			cardRecastable(card, player) {
				return lib.skill.ql_yening.mod.cardEnabled.apply(this, arguments);
			},
			cardDiscardable(card, player) {
				return lib.skill.ql_yening.mod.cardEnabled.apply(this, arguments);
			},
			cardGiftable(card, player) {
				return lib.skill.ql_yening.mod.cardEnabled.apply(this, arguments);
			},
			canBeReplaced(card, player) {
				return lib.skill.ql_yening.mod.cardEnabled.apply(this, arguments);
			},
			canBeGained(card, source, player) {
				const equips = player.getStorage("ql_yening");
				if (!equips.length) {
					return;
				}
				const cards = [card];
				if (Array.isArray(card?.cards)) {
					cards.addArray(card.cards);
				}
				if (cards.length && cards.containsSome(...equips)) {
					return false;
				}
			},
			canBeDiscarded(card, source, player) {
				return lib.skill.ql_yening.mod.canBeGained.apply(this, arguments);
			},
		},
		derivation: ["ql_mingyong", "ql_duiying", "ql_dishuanganshi"],
		group: ["ql_yening_nolose", "ql_yening_init", "ql_yening_recast"],
		subSkill: {
			init: {
				trigger: {
					global: ["phaseBefore", "loseAfter", "cardsDiscardAfter", "loseAsyncAfter"],
					player: "enterGame",
				},
				forced: true,
				persevereSkill: true,
				filter(event, player, name) {
					if (!name.endsWith("After")) {
						return event.name != "phase" || game.phaseNumber == 0;
					}
					const check = evt => {
						if (!["lose", "cardsDiscard", "loseAsync"].includes(evt.name)) {
							return false;
						}
						if (evt.name != "cardsDiscard" && (evt.getlx === false || evt.position != ui.discardPile)) {
							return false;
						}
						return true;
					};
					if (!check(event)) {
						return false;
					}
					const evts = game.getAllGlobalHistory("cardMove", check, event).slice(0).reverse();
					let num = 0;
					for (const evt of evts) {
						if (evt.checkByyening) {
							break;
						}
						num += evt.cards.length;
					}
					return num >= 20;
				},
				async content(event, trigger, player) {
					if (event.triggername.endsWith("After")) {
						trigger.set("checkByyening", true);
					}
					await player.draw(2);
					const cards = player.getStorage("ql_yening");
					const list = [
						["diamond", 6, "ql_tongbi"],
						["heart", 13, "ql_duanpo"],
						["club", 12, "ql_zhuiming"],
					].filter(info => cards.every(card => !card || !info.includes(card.name)));
					const result = await player
						.chooseButton([
							`夜幕：选择要${cards.length ? "切换" : "装备"}的武器`,
							[list, "vcard"],
						], true)
						.set("ai", () => Math.random())
						.forResult();
					if (!result?.bool || !result.links?.length) {
						return;
					}
					const info = result.links[0];
					if (cards.length) {
						const [card] = cards;
						player.removeEquipTrigger(card.card || card);
						game.broadcastAll((card, info, player) => {
							card.init(info);
							const vcard = card.cardSymbol && card[card.cardSymbol];
							if (vcard && player.vcardsMap?.equips) {
								const newCard = get.autoViewAs(card, void 0, false);
								player.vcardsMap.equips[player.vcardsMap.equips.indexOf(vcard)] = newCard;
								card[card.cardSymbol] = newCard;
							}
						}, card, info, player);
						player.addEquipTrigger(card.card || card);
					} else {
						const card = game.createCard(info[2], ...info.slice(0, 2));
						player.markAuto("ql_yening", card);
						player.$gain2(card);
						await player.equip(card);
					}
				},
			},
			nolose: {
				trigger: {
					player: ["loseBefore", "disableEquipBefore"],
				},
				forced: true,
				persevereSkill: true,
				filter(event, player) {
					if (event.name == "disableEquip") {
						return event.slots.includes("equip1");
					}
					const cards = player.getStorage("ql_yening");
					return cards.length && event.cards.containsSome(...cards);
				},
				async content(event, trigger, player) {
					if (trigger.name == "lose") {
						trigger.cards.removeArray(player.getStorage("ql_yening"));
					} else {
						while (trigger.slots.includes("equip1")) {
							trigger.slots.remove("equip1");
						}
					}
				},
			},
			recast: {
				enable: "phaseUse",
				position: "he",
				locked: true,
				persevereSkill: true,
				filter(event, player) {
					return player.countCards("he", card => get.info("ql_yening_recast").filterCard(card, player));
				},
				filterCard(card, player) {
					if (player.getStorage("ql_yening").includes(card)) {
						return false;
					}
					return get.subtypes(card).includes("equip1") && player.canRecast(card);
				},
				check(card) {
					if (get.position(card) == "e") {
						return 0.5 - get.value(card, get.player());
					}
					if (!get.player().hasEquipableSlot(get.subtype(card))) {
						return 5;
					}
					return 3 - get.value(card);
				},
				async content(event, trigger, player) {
					await player.recast(event.cards);
				},
				discard: false,
				lose: false,
				delay: false,
				prompt: "重铸一张武器牌",
				ai: {
					order: 10,
					result: {
						player: 1,
					},
				},
			},
		},
	},
	ql_mingyong: {
		trigger: {
			source: "damageSource",
		},
		equipSkill: true,
		filter(event, player) {
			let evt = event;
			while (evt.name) {
				evt = evt.getParent("useCard");
				if (evt.markByMingyong) {
					return false;
				}
			}
			const card = get.autoViewAs({ name: "sha", isCard: true, storage: { ql_mingyong: true } });
			return event.player?.isIn() && player.canUse(card, event.player, false);
		},
		async cost(event, trigger, player) {
			const cards = player.getStorage("ql_yening");
			const list = [
				["diamond", 6, "ql_tongbi"],
				["heart", 13, "ql_duanpo"],
				["club", 12, "ql_zhuiming"],
			].filter(info => cards.every(card => !card || !info.includes(card.name)));
			if (!list.length) {
				return;
			}
			const result = await player
				.chooseButton([
					get.prompt(event.skill, trigger.player),
					`<div class="text center">视为对${get.translation(trigger.player)}使用一张无视防具的【杀】，且期间你视为装备着选择的武器</div>`,
					[list, "vcard"],
				])
				.set("ai", () => Math.random())
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const { cost_data: info, targets: [target] } = event,
				sha = get.autoViewAs({ name: "sha", isCard: true, storage: { ql_mingyong: true } });
			if (player.canUse(sha, target, false)) {
				const vcard = { name: info[2], suit: info[0], number: info[1] }
				player.markAuto("ql_yening", vcard);
				const card = player.getStorage("ql_yening").find(card => get.itemtype(card) == "card");
				if (card) {
					card.node.name2.innerHTML = `<span style="color:#f5f22d">${get.translation(vcard.suit)}${get.strNumber(vcard.number)} ${get.translation(vcard.name)}</span>`;
				}
				const skills = player.getStorage("ql_yening").filter(card => {
					return get.itemtype(card) != "card";
				}).map(card => lib.card[card.name].skills[0]);
				player.addAdditionalSkill("ql_yening", skills);

				const next = player.useCard(sha, target, false);
				next.set("markByMingyong", true);
				await next;

				player.unmarkAuto("ql_yening", vcard);
				if (card) {
					card.node.name2.innerHTML = `${get.translation(card.suit)}${get.strNumber(card.number)} ${get.translation(card.name)}`;
				}
				const skills2 = player.getStorage("ql_yening").filter(card => {
					return get.itemtype(card) != "card";
				}).map(card => lib.card[card.name].skills[0]);
				player.addAdditionalSkill("ql_yening", skills2);
			}
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (!arg?.card?.storage?.ql_mingyong) {
					return false;
				}
			},
		},
	},
	ql_duiying: {
		trigger: {
			source: "damageSource",
		},
		equipSkill: true,
		filter(event, player) {
			let evt = event;
			while (evt.name) {
				evt = evt.getParent("useCard");
				if (evt.markByDuiying) {
					return false;
				}
			}
			return true; //player.isDamaged();
		},
		getIndex(event) {
			return event.num;
		},
		async content(event, trigger, player) {
			await player.recover();
			player
				.when({
					player: "useCard0",
				})
				.filter(evt => get.tag(evt.card, "damage") && get.type(evt.card) != "delay")
				.step(async (event, trigger, player) => {
					if (trigger.markByDuiying) {
						return;
					}
					trigger.set("markByDuiying", true);
					const cards = player.getStorage("ql_yening");
					const list = [
						["diamond", 6, "ql_tongbi"],
						["heart", 13, "ql_duanpo"],
						["club", 12, "ql_zhuiming"],
					].filter(info => cards.every(card => !card || !info.includes(card.name)));
					if (!list.length) {
						return;
					}
					const result = await player
						.chooseButton([
							get.translation("ql_duiying"),
							`<div class="text center">选择${get.translation(trigger.card)}结算期间你视为装备着的武器</div>`,
							[list, "vcard"],
						], true)
						.set("ai", () => Math.random())
						.forResult();
					if (result?.bool && result.links?.length) {
						const info = result.links[0];
						const vcard = { name: info[2], suit: info[0], number: info[1] };
						player.markAuto("ql_yening", vcard);
						const card = player.getStorage("ql_yening").find(card => get.itemtype(card) == "card");
						if (card) {
							card.node.name2.innerHTML = `<span style="color:#f5f22d">${get.translation(vcard.suit)}${get.strNumber(vcard.number)} ${get.translation(vcard.name)}</span>`;
						}
						const skills = player.getStorage("ql_yening").filter(card => {
							return get.itemtype(card) != "card";
						}).map(card => lib.card[card.name].skills[0]);
						player.addAdditionalSkill("ql_yening", skills);
						player
							.when({
								player: "useCardAfter",
							})
							.filter(evt => evt == trigger)
							.step(async (event, trigger, player) => {
								player.unmarkAuto("ql_yening", vcard);
								if (card) {
									card.node.name2.innerHTML = `${get.translation(card.suit)}${get.strNumber(card.number)} ${get.translation(card.name)}`;
								}
								const skills2 = player.getStorage("ql_yening").filter(card => {
									return get.itemtype(card) != "card";
								}).map(card => lib.card[card.name].skills[0]);
								player.addAdditionalSkill("ql_yening", skills2);
							});
					}
				});
		},
	},
	ql_dishuanganshi: {
		nobracket: true,
		equipSkill: true,
		trigger: {
			source: "damageSource",
			player: "useCardToPlayered",
		},
		filter(event, player) {
			let evt = event;
			while (evt.name) {
				evt = evt.getParent("useCard");
				if (evt.markByDishuang) {
					return false;
				}
			}
			if (event.name == "damage") {
				return event.player?.isIn();
			}
			return event.target?.isIn() && event.target.countDiscardableCards(player, "hej");
		},
		async cost(event, trigger, player) {
			if (trigger.name == "damage") {
				event.result = await player
					.chooseBool(get.prompt(event.skill, trigger.player), "令其不能使用锦囊牌直到其回合结束")
					.set("choice", get.attitude(player, trigger.player) <= 0)
					.forResult();
				event.result.targets = [trigger.player];
				return;
			}
			const result = await player
				.discardPlayerCard(get.prompt2(event.skill, trigger.target), trigger.target, "hej")
				.set("chooseonly", true)
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					targets: [trigger.target],
					cost_data: result.links,
				};
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				const { targets: [target] } = event;
				target.addTempSkill("ql_dishuanganshi_effect", { player: "phaseEnd" });
				return;
			}
			const { cost_data: discards, targets: [target] } = event;
			await target.modedDiscard(discards, player);
			const cards = player.getStorage("ql_yening");
			if (cards.every(card => get.itemtype(card) != "card" || card.name != "ql_zhuiming")) {
				return;
			}
			const evt = trigger.getParent();
			evt.set("markByDishuang", true);
			const list = [
				["diamond", 6, "ql_tongbi"],
				["heart", 13, "ql_duanpo"],
				["club", 12, "ql_zhuiming"],
			].filter(info => cards.every(card => !card || !info.includes(card.name)));
			if (!list.length) {
				return;
			}
			const result = await player
				.chooseButton([
					get.translation(event.name),
					`<div class="text center">选择${get.translation(trigger.card)}结算期间你视为装备着的武器</div>`,
					[list, "vcard"],
				], true)
				.set("ai", () => Math.random())
				.forResult();
			if (result?.bool && result.links?.length) {
				const info = result.links[0];
				const vcard = { name: info[2], suit: info[0], number: info[1] };
				player.markAuto("ql_yening", vcard);
				const card = player.getStorage("ql_yening").find(card => get.itemtype(card) == "card");
				if (card) {
					card.node.name2.innerHTML = `<span style="color:#f5f22d">${get.translation(vcard.suit)}${get.strNumber(vcard.number)} ${get.translation(vcard.name)}</span>`;
				}
				const skills = player.getStorage("ql_yening").filter(card => {
					return get.itemtype(card) != "card";
				}).map(card => lib.card[card.name].skills[0]);
				player.addAdditionalSkill("ql_yening", skills);
				player
					.when({
						player: "useCardAfter",
					})
					.filter(evtx => evt == evtx)
					.step(async (event, trigger, player) => {
						player.unmarkAuto("ql_yening", vcard);
						if (card) {
							card.node.name2.innerHTML = `${get.translation(card.suit)}${get.strNumber(card.number)} ${get.translation(card.name)}`;
						}
						const skills2 = player.getStorage("ql_yening").filter(card => {
							return get.itemtype(card) != "card";
						}).map(card => lib.card[card.name].skills[0]);
						player.addAdditionalSkill("ql_yening", skills2);
					});
			}
		},
		subSkill: {
			effect: {
				init(player, skill) {
					player.addTip(skill, "坠明 限锦");
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				charlotte: true,
				mark: true,
				marktext: "禁",
				intro: {
					markcount: () => 0,
					content: "仅能使用锦囊牌",
				},
				mod: {
					cardEnabled(card, player) {
						if (get.type2(card) != "trick") {
							return false;
						}
					},
					cardSavable(card, player) {
						if (get.type2(card) != "trick") {
							return false;
						}
					},
				},
			},
		},
	},
	//韦鲁斯
	ql_chouyu: {
		locked: true,
		forced: true,
		trigger: {
			global: ["linkAfter", "turnOverAfter"],
		},
		async content(event, trigger, player) {
			await player.draw("nodelay");
			player.addTempSkill(event.name + "_add");
			player.addMark(event.name + "_add");
		},
		subSkill: {
			add: {
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("ql_chouyu_add");
						}
					},
				},
			},
		},
	},
	ql_kuwei: {
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			return event.card && event.player != player && !event.player.isLinked() && event.player.isIn();
		},
		logTarget: "player",
		check(event, player) {
			return true;
		},
		async content(event, trigger, player) {
			if (!trigger.card.storage?.[event.name] && !_status[event.name]) {
				_status[event.name] = [];
				const evt = event.getParent(evtx => evtx.name == "useCard" && evtx.card == trigger.card, true);
				if (evt) {
					const next = game.createEvent(`${event.name}_delete`, false, evt);
					next.set("player", player);
					next.setContent(async (event, trigger, player) => {
						delete _status.ql_kuwei;
					});
					evt.next.remove(next);
					evt.after.push(next);
				}
			}
			const { targets: [target] } = event;
			const { card } = trigger;
			await target.link(true);
			const targets = [target.getNext(), target.getPrevious()].unique().filter(i => !_status[event.name]?.includes(i));
			const vcard = get.autoViewAs({ name: card.name, nature: card.nature, isCard: true, storage: { ql_kuwei: true } });
			if (targets.some(target => player.canUse(vcard, target, false, false))) {
				const result = await player
					.chooseTarget(`枯萎：视为对${get.translation(target)}的上家或下家使用${get.translation(vcard)}`, (card, player, target) => {
						return player.canUse(card, target, false, false) && get.event().targets.includes(target);
					})
					.set("targets", targets)
					.set("_get_card", vcard)
					.set("ai", target => {
						const card = get.card();
						const player = get.player();
						return get.effect(target, card, player, player);
					})
					.forResult();
				if (result?.bool && result.targets?.length) {
					const { targets } = result;
					_status[event.name].addArray(targets);
					await player.useCard(vcard, targets, false);
				}
			}
		}
	},
	ql_baisuo: {
		limited: true,
		enable: "phaseUse",
		skillAnimation: true,
		animationColor: "metal",
		filterTarget(card, player, target) {
			return target != player;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const { target } = event;
			await target.link(true);
			const targets = game.filterPlayer(target => target.isLinked());
			await game.doAsyncInOrder(targets, async target => target.turnOver(true));
			await player.draw(targets.length);
			const card = game.createCard2("ql_anyizhigong", "diamond", 1);
			await player.gain(card, "gain2");
			if (player.getCards("h").includes(card) && player.hasUseTarget(card)) {
				await player.chooseUseTarget(card, true);
			}
		},
		ai: {
			order: 5,
			reuslt: {
				target: -1,
			}
		}
	},
	ql_anyizhigong_skill: {
		equipSkill: true,
		forced: true,
		trigger: { source: "damageBegin1" },
		filter(event, player) {
			return event.player.isLinked();
		},
		async content(event, trigger, player) {
			game.setNature(trigger, "thunder");
			trigger.num++;
		}
	},
	//许褚
	ql_zhanshen: {
		audio: "zhuangpo",//"ext:五花米线/audio/skill:2",
		trigger: { player: ["useCard", "respond"] },
		filter(event, player) {
			return event.card.name == "sha";
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([
					get.prompt2(event.skill),
					[
						[
							["addCount", "此【杀】不计入次数"],
							["damage", "此【杀】伤害+1"],
							["target", "此【杀】可额外指定一个目标"],
							["draw", "摸一张牌"],
							["beishui", "背水：你失去一点体力或减一点体力上限"],
						],
						"textbutton",
					]
				])
				.set("card", trigger.card)
				.set("targets", trigger.targets)
				.set("filterButton", button => {
					const { card, player, targets } = get.event();
					if (button.link == "target") {
						return game.hasPlayer(target => !targets?.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target));
					}
					return true;
				})
				.set("ai", button => {
					const { card, player, targets } = get.event();
					const trigger = get.event().getTrigger();
					const { link } = button;
					if (link == "draw" && trigger.name == "respond") {
						return 100;
					}
					if (link == "beishui" && (player.getDamagedHp() > 0 || player.hp > 2)) {
						return 100;
					}
					switch (link) {
						case "addCount": return player.getUseValue({ name: "sha" }, true, false);
						case "damage": return Math.max(...(targets || []).map(target => get.effect(target, card, player, player)));
						case "target": return Math.max(...game.filterPlayer(target => !targets?.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target)).map(target => get.effect(target, card, player, player)));
						case "draw": return get.effect(player, { name: "draw" }, player, player);
						case "beishui": return 0;
					}
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				const { links } = result;
				event.result = {
					bool: true,
					cost_data: links[0],
				}
			}
		},
		async content(event, trigger, player) {
			const { cost_data: link } = event;
			const { card, targets } = trigger;
			if (["addCount", "beishui"].includes(link)) {
				trigger.addCount = false;
				const stat = player.getStat().card,
					name = card.name;
				if (typeof stat[name] == "number") {
					stat[name]--;
				}
				game.log(card, "不计入次数");
			}
			if (["damage", "beishui"].includes(link)) {
				trigger.baseDamage++;
				game.log(card, "造成的伤害+1");
			}
			if (["target", "beishui"].includes(link)) {
				if (trigger.name == "useCard" && game.hasPlayer(target => !targets?.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target))) {
					const result = await player
						.chooseTarget(`战神：为${get.translation(card)}额外选择一个目标`, (card, player, target) => {
							const { targets } = get.event();
							return !targets.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
						})
						.set("_get_card", card)
						.set("targets", targets)
						.set("ai", target => {
							return get.effect(target, get.card(), get.player(), get.player());
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						const { targets } = result;
						player.line(targets);
						game.log(targets, "成为", card, "的额外目标");
						trigger.targets.addArray(targets);
					}
				}
			}
			if (["draw", "beishui"].includes(link)) {
				await player.draw();
			}
			if (link == "beishui") {
				const result = await player
					.chooseControl()
					.set("prompt", "战神：请选择一项")
					.set("choiceList", ["失去一点体力", "减少一点体力上限"])
					.set("choice", player.isDamaged() ? 1 : 0)
					.forResult();
				if (result?.control) {
					if (result.index == 0) {
						await player.loseHp();
					}
					else {
						await player.loseMaxHp();
					}
				}
			}
		},
	},
	ql_douwu: {
		audio: "zhengqing",//"ext:五花米线/audio/skill:2",
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("hes") > 0;
		},
		usable: 1,
		filterCard: true,
		position: "hes",
		viewAs: {
			name: "juedou",
		},
		async precontent(event, trigger, player) {
			event.getParent().oncard = function () {
				const { card } = get.event();
				player
					.when("useCardAfter")
					.filter(evt => evt.card == card)
					.step(async (event, trigger, player) => {
						if (!player.hasHistory("damage", evt => evt.card == trigger.card)) {
							if (player.maxHp > 5) {
								const result = await player.chooseDrawRecover(2, 1);
							} else {
								await player.recover();
								await player.draw(2);
							}
						}
						else if (player.maxHp > 5) {
							await player.loseMaxHp();
						}
					})
			}
		}
	},
	ql_guojue: {
		forced: true,
		trigger: {
			player: "changeHpAfter",
		},
		filter(event, player) {
			return event.num < 0;
		},
		async content(event, trigger, player) {
			const evtx = event;
			for (const i of [1, 2, 3]) {
				player
					.when({
						global: "useCard",
					})
					.filter(evt => !evt.isRespondByGuojue?.includes(evtx))
					.assign({
						priority: i,
					})
					.step(async (event, trigger, player) => {
						trigger.set("isRespondByGuojue", (trigger.isRespondByGuojue || []).concat([evtx]));
						await player.draw();
						if (i === 1 && trigger.targets?.length) {
							const targets = trigger.targets?.filter(target => {
								return target.countDiscardableCards(player, "hej");
							});
							if (!targets?.length) {
								return;
							}
							const result = await player
								.chooseTarget("果决：是否弃置此牌一名目标区域内至多两张牌？", (card, player, target) => {
									return get.event().targetx.includes(target);
								})
								.set("targetx", targets)
								.set("ai", target => {
									const player = get.player();
									return get.effect(target, { name: "guohe" }, player, player);
								})
								.forResult();
							if (result?.bool && result.targets?.length) {
								const target = result.targets[0];
								await player.discardPlayerCard(target, "hej", [1, 2], true);
							}
						}
					})
			}
		},
	},
	ql_xunci: {
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return player.hasUseTarget(get.autoViewAs({ name: "sha", isCard: true }), false);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return player.canUse(get.autoViewAs({ name: "sha", isCard: true }), target, false);
				})
				.set("ai", target => {
					const player = get.player(),
						card = get.autoViewAs({ name: "sha", isCard: true });
					return get.effect(target, card, player, player) - get.effect(player, { name: "losehp" }, player, player) / 2;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets: [target], name } = event,
				card = get.autoViewAs({ name: "sha", isCard: true });
			await player.loseHp();
			if (player.canUse(card, target, false)) {
				await player.useCard(card, target, false);
			}
			const skill = `${name}_effect`;
			player.addTempSkill(skill);
			player.markAuto(skill, target);
		},
		subSkill: {
			effect: {
				intro: {
					content: "本回合$视为在你的攻击范围内",
				},
				charlotte: true,
				onremove: true,
				mod: {
					inRange(from, to) {
						if (from.getStorage("ql_xunci_effect").includes(to)) {
							return true;
						}
					},
				},
			},
		},
	},
	ql_xinwei: {
		trigger: {
			global: "roundStart",
		},
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.addTempSkill("ql_xinwei_effect", { global: "phaseEnd" });
			const card = game.createCard("ql_anyizhidao", "spade", 1);
			await player.gain(card, "gain2");
			if (player.hasUseTarget(card)) {
				await player.chooseUseTarget(card, true);
			}
			player
				.when({
					global: "roundEnd",
				})
				.step(async (event, trigger, player) => {
					if (get.position(card) !== "e" || get.owner(card) !== player) {
						return;
					}
					if (!get.nameList(player).includes("ql_zhaoxin")) {
						return;
					}
					await player.reinitCharacter("ql_zhaoxin", "ql_yaheng")
				});
		},
		subSkill: {
			effect: {
				trigger: {
					target: "useCardToTarget",
				},
				filter(event, player) {
					return event.player != player && get.distance(player, event.player) > 1;
				},
				forced: true,
				locked: false,
				charlotte: true,
				async content(event, trigger, player) {
					trigger.getParent().targets.remove(player);
					trigger.getParent().triggeredTargets2.remove(player);
					trigger.untrigger();
				},
			},
		},
	},
	ql_hengzhi: {
		forced: true,
		trigger: {
			player: "changeHpAfter",
		},
		filter(event, player) {
			return event.num != 0;
		},
		async content(event, trigger, player) {
			const evtx = event;
			for (const i of [1, 2, 3]) {
				player
					.when({
						global: "useCard",
					})
					.filter(evt => !evt.isRespondByHengzhi?.includes(evtx))
					.assign({
						priority: i,
					})
					.step(async (event, trigger, player) => {
						trigger.set("isRespondByHengzhi", (trigger.isRespondByHengzhi || []).concat([evtx]));
						await player.draw();
						if (i === 1 && trigger.targets?.length) {
							const targets = trigger.targets?.filter(target => {
								return target.countDiscardableCards(player, "hej");
							});
							if (!targets?.length) {
								return;
							}
							const result = await player
								.chooseTarget("恒志：是否弃置此牌一名目标区域内至多两张牌？", (card, player, target) => {
									return get.event().targetx.includes(target);
								})
								.set("targetx", targets)
								.set("ai", target => {
									const player = get.player();
									return get.effect(target, { name: "guohe" }, player, player);
								})
								.forResult();
							if (result?.bool && result.targets?.length) {
								const target = result.targets[0];
								await player.discardPlayerCard(target, "hej", [1, 2], true);
							}
						}
						if (i === 3) {
							const result = await player
								.chooseBool(`是否令${get.translation(trigger.player)}使用的${get.translation(trigger.card)}额外结算一次？`)
								.set("choice", get.attitude(player, trigger.player) > 0)
								.forResult();
							if (result?.bool) {
								trigger.effectCount++;
								const skill = "ql_hengzhi_effect";
								player.addTempSkill(skill);
								player.markAuto(skill, trigger.card);
							}
						}
					})
			}
		},
		subSkill: {
			effect: {
				trigger: {
					global: "damageSource",
				},
				filter(event, player) {
					return event.card && player.getStorage("ql_hengzhi_effect").includes(event.card);
				},
				forced: true,
				charlotte: true,
				async content(event, trigger, player) {
					await player.recover();
				},
			},
		},
	},
	ql_chie: {
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return player.hasUseTarget(get.autoViewAs({ name: "sha", isCard: true }), false);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return player.canUse(get.autoViewAs({ name: "sha", isCard: true }), target, false);
				}, [1, Infinity])
				.set("ai", target => {
					const player = get.player(),
						card = get.autoViewAs({ name: "sha", isCard: true });
					return get.effect(target, card, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets, name } = event,
				card = get.autoViewAs({ name: "sha", isCard: true });
			await player.loseHp();
			await player.useCard(card, targets, false);
			const skill = `${name}_effect`;
			player.addTempSkill(skill);
			player.markAuto(skill, targets);
		},
		subSkill: {
			effect: {
				intro: {
					content: "本回合$视为在你的攻击范围内，且你$使用牌没有次数限制",
				},
				charlotte: true,
				onremove: true,
				mod: {
					inRange(from, to) {
						if (from.getStorage("ql_chie_effect").includes(to)) {
							return true;
						}
					},
					cardUsableTarget(card, player, target) {
						if (player.getStorage("ql_chie_effect").includes(target) || player == target) {
							return Infinity;
						}
					},
				},
			},
		},
	},
	ql_dashe: {
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		multiline: true,
		multitarget: true,
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			return ui.selected.targets.every(targetx => [target.getNext(), target.getPrevious()].includes(targetx));
		},
		filter(event, player) {
			return game.countPlayer(current => current != player) > 1;
		},
		selectTarget: 2,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const target = event.targets.find(target => event.targets.includes(target.getPrevious()));
			if (target) {
				game.broadcastAll((target1, target2) => {
					game.swapSeat(target1, target2, null, true);
				}, player, target);
			}
			await player.addSkill(event.name + "_damage");
			for (const i of [player.getPrevious(), player.getNext()]) {
				if (i?.isIn()) {
					player.line(i);
					await i.damage(player);
				}
			}
			player.insertPhase();
		},
		ai: {
			order: 3,
			result: {
				target(player, target) {
					return get.damageEffect(target, player, target);
				},
			},
		},
		subSkill: {
			damage: {
				charlotte: true,
				onremove: true,
				forced: true,
				trigger: {
					source: "damageBegin1",
				},
				filter(event, player) {
					return player.getEquip("ql_anyizhidao") && player.countMark("ql_anyizhidai_skill") >= 15;
				},
				logTarget: "player",
				async content(event, trigger, player) {
					//player.chat("达咩！");
					trigger.num *= 20;
				}
			},
		},
	},
	ql_anyizhidao_skill: {
		equipSkill: true,
		trigger: {
			player: ["damageEnd", "dieBegin"],
			source: ["damageSource", "damageBegin1"],
		},
		filter(event, player, name) {
			const num = event.name == "die" ? 10 : name == "damageBegin1" ? 5 : 0;
			return player.countMark("ql_anyizhidao_skill") >= num;
		},
		forced: true,
		marktext: "能",
		intro: {
			name: "能量",
			name2: "能量",
			content: "当前能量：#",
		},
		async content(event, trigger, player) {
			if (trigger.name == "die") {
				await player.recoverTo(player.maxHp);
				if (player.getHp() > 0) {
					trigger.cancel();
				}
				player.removeMark(event.name, 10);
				return;
			}
			if (event.triggername == "damageBegin1") {
				trigger.num++;
				return;
			}
			player.addMark(event.name, 1);
		},
	},
	//许邵
	ql_pingjian: {
		trigger: {
			global: "roundStart",
		},
		forced: true,
		/*onremove(player, skill) {
			if (player.getStorage("ql_pingjian_character", false)) {
				lib.skill.ql_pingjian.characterList.add(player.getStorage("ql_pingjian_character", false));
				player.setStorage("ql_pingjian_character", false);
			}
		},*/
		intro: {
			/*onunmark(storage, player) {
				if (player.getStorage("ql_pingjian_character", false)) {
					lib.skill.ql_pingjian.characterList.add(player.getStorage("ql_pingjian_character", false));
					player.setStorage("ql_pingjian_character", false);
				}
			},*/
			mark(dialog, storage, player) {
				if (player.getStorage("ql_pingjian_character", false)) {
					dialog.addText("当前选择的武将牌");
					dialog.add([player.getStorage("ql_pingjian_character", false), "character"]);
				} else {
					return "暂未选择武将牌";
				}
			},
		},
		async content(event, trigger, player) {
			/*if (player.getStorage("ql_pingjian_character", false)) {
				lib.skill.ql_pingjian.characterList.add(player.getStorage("ql_pingjian_character", false));
				player.setStorage("ql_pingjian_character", false);
			}*/
			await player.removeAdditionalSkills("ql_pingjian");
			const characterList = lib.skill.ql_pingjian.characterList.slice().filter(i => get.character(i)?.skills?.length);
			if (!characterList.length) {
				game.log("但是，武将池没有武将牌了！");
				return;
			}
			const result = await player.chooseButton(["评鉴：选择两张武将牌", [characterList.randomGets(5), "character"]], 2, true).forResult();
			let links = characterList.randomGets(2);
			if (result && result.links) {
				links = result.links.slice();
			}
			player.setStorage("ql_pingjian_character", links);
			const skills = [];
			for (let i = 0; i < 2; i++) {
				//lib.skill.ql_pingjian.characterList.remove(links[i]);
				skills.addArray(get.character(links[i]).skills);
			}
			await player.addAdditionalSkills("ql_pingjian", skills);
			if (player.maxHp < 4) {
				await player.gainMaxHp(4 - player.maxHp);
			}
			await player.chooseDrawRecover();
		},
		//↓武将池数组
		characterList: ["yl_luzhi", "dc_liuyu", "dc_liru", "xin_gaoshun", "sp_sufei", "sp_zhaoyun", "sp_xunchen", "re_gongsunzan", "re_lvbu", "re_pangde", "re_huatuo", "re_zhangliang", "re_yuanshu", "shenpei", "wutugu", "chendeng", "zhanglu", "wangyun", "guosi", "zhangji", "shixie", "caiyong", "guotufengji", "taoqian", "liubiao", "zhangbao", "yanbaihu"],
	},
	//暗裔剑魔（达咩）
	ql_cisi: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: { source: "damageSource" },
		filter(event, player) {
			return get.name(event.card) == "sha";
		},
		forced: true,
		async content(event, trigger, player) {
			await player.draw();
			if (player.getRoundHistory("sourceDamage", evt => evt.card.name == "sha").indexOf(trigger) == 0 && player.isDamaged()) {
				await player.recover();
			}
		}
	},
	ql_cisix: {
		audio: "ext:五花米线/audio/skill:2",
		equipSkill: true,
		inherit: "ql_cisi",
	},
	ql_anren: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		locked: false,
		group: ["ql_anren_directHit"],
		async content(event, trigger, player) {
			const list = [
				["点数不同", "number"],
				["类型不同", "type2"],
				["花色不同", "suit"],
			];
			await player.drawTo(2);
			for (const item of list) {
				await player
					.chooseToUse()
					.set("openskilldialog", `${get.translation(event.name)}：是否将两张${item[0]}的牌当作无距离限制的【杀】使用？`)
					.set("norestore", true)
					.set("_backupevent", `${event.name}_backup`)
					.set("custom", {
						add: {},
						replace: { window() { } },
					})
					.backup(`${event.name}_backup`)
					.set("funcName", item[1])
					.set("targetRequired", true)
					.set("complexTarget", true)
					.set("complexCard", true)
					.set("complexSelect", true)
					.set("addCount", false);
			}
		},
		subSkill: {
			backup: {
				log: false,
				filterCard(card, player) {
					if (get.itemtype(card) != "card") {
						return false;
					}
					const { cards } = ui.selected;
					if (!cards.length) {
						return true;
					}
					const name = get.event().funcName;
					return get[name](card) != get[name](cards[0]);
				},
				viewAs: {
					name: "sha",
				},
				selectCard: 2,
				position: "hes",
				selectTarget: [1, 2],
				filterTarget(...args) {
					return lib.filter.targetEnabled.call(this, ...args);
				},
			},
			directHit: {
				trigger: {
					global: "useCard",
				},
				filter(event, player) {
					return event.card.name == "sha";
				},
				check(event, player) {
					return !event.directHit.containsAll(event.targets) && event.targets.reduce((sum, target) => sum + get.effect(target, event.card, event.player, player), 0) > 0;
				},
				logTarget: "player",
				prompt2: (event) => `失去一点体力令${get.translation(event.card)}不可响应`,
				async content(event, trigger, player) {
					await player.loseHp();
					trigger.directHit.addArray(game.players);
				}
			},
		},
	},
	ql_damie: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			player: "die",
		},
		forceDie: true,
		forceOut: true,
		filter(event, player) {
			return !event.reverseOut && game.hasPlayer(target => target != player);
		},
		forced: true,
		async content(event, trigger, player) {
			const result = await player.chooseTarget(`大灭：${get.skillInfoTranslation(event.name, player)}`, true, lib.filter.notMe).forResult();
			const { targets } = result;
			if (targets?.length) {
				player.line(targets);
				const [target] = targets;
				player.addSkill(`${event.name}_damage`);
				player.addSkill(`${event.name}_revive`);
				player.setStorage(`${event.name}_revive`, target);
				const card = game.createCard2("ql_anyizhijian", "heart", 1);
				await target.gain(card, "gain2");
				if (target.hasUseTarget(card)) {
					await target.chooseUseTarget(card, true);
				}
			}
		},
		subSkill: {
			damage: {
				charlotte: true,
				onremove: true,
				forced: true,
				trigger: {
					source: "damageBegin1",
				},
				filter(event, player) {
					return player.countMark("ql_damie_damage") >= 3;
				},
				logTarget: "player",
				async content(event, trigger, player) {
					player.chat("达咩！");
					trigger.num *= 20;
				}
			},
			revive: {
				charlotte: true,
				forced: true,
				onremove: true,
				forceDie: true,
				forceOut: true,
				trigger: {
					global: "dieAfter",
				},
				filter(event, player) {
					return !event.reverseOut && event.player == player.storage.ql_damie_revive;
				},
				logTarget: "player",
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					player.addMark("ql_damie_damage", 1, false);
					const { targets: [target] } = event;
					game.broadcastAll((player, target) => {
						game.swapSeat(player, target);
					}, player, target);
					await player.reviveEvent(player.maxHp);
					await player.draw(4);
					player.insertPhase();
				},
			},
		}
	},
	//五弦琵琶
	ql_pipa: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: ["phaseBefore", "recoverBefore", "dying"],
			player: ["enterGame", "loseBefore", "loseMaxHpBefore", "phaseUseBegin"],
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		filter(event, player) {
			if (get.translation(player).indexOf("琵琶") < 0) {
				return false;
			}
			if (event.name == "lose") {
				const cards = player.getCards("h", card => {
					const tags = card?.gaintag || [];
					return tags.length && tags.some(tag => tag.startsWith("ql_pipa_yinyun"));
				});
				return event.cards?.length && event.cards.containsSome(...cards);
			}
			if (event.name == "loseMaxHp") {
				return player.maxHp - event.num < 7;
			}
			if (event.name == "recover") {
				const evt = event.getParent();
				return get.sourceSkillFor(evt.skill || evt.name) !== "ql_pipa";
			}
			if (event.name == "dying") {
				return event.reason?.name != "damage";
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async cost(event, trigger, player) {
			if (trigger.name == "dying") {
				event.result = await player
					.chooseBool(get.prompt(event.skill, trigger.player), "令其回复全部体力")
					.set("choice", get.recoverEffect(trigger.player, player, player) > 0)
					.forResult();
			} else {
				event.result = {
					bool: true,
				};
			}
			if (["recover", "dying"].includes(trigger.name)) {
				event.result.targets = [trigger.player];
			}
		},
		async content(event, trigger, player) {
			switch (trigger.name) {
				case "lose": {
					const cards = player.getCards("h", card => {
						const tags = card?.gaintag || [];
						return tags.length && tags.some(tag => tag.startsWith("ql_pipa_yinyun"));
					});
					for (let i = 0; i < trigger.cards.length; i++) {
						const card = trigger.cards[i];
						if (cards.includes(card)) {
							trigger.cards.splice(i--, 1);
						}
					}
					if (!trigger.cards.length) {
						trigger.cancel();
					}
					return;
				}
				case "loseMaxHp": {
					const num = player.maxHp - 7;
					if (num == 0) {
						trigger.cancel();
					} else if (trigger.num > num) {
						trigger.num = num;
					}
					return;
				}
				case "recover": {
					trigger.cancel();
					return;
				}
				case "dying": {
					const target = event.targets[0];
					await target.recoverTo(target.maxHp);
					return;
				}
				case "phaseUse": {
					await player.draw(7);
					const list = [],
						cards = player.getCards("h");
					for (let i = 0; i < 7; i++) {
						const tag = `ql_pipa_yinyun${i}`,
							card = cards.find(card => card.hasGaintag(tag));
						const info = [get.translation(tag).slice(3), []];
						if (card) {
							info[1].add(card);
							cards.remove(card);
						}
						list.add(info);
					}
					const next = player.chooseToMove_new("琵琶");
					next.set("list", [
						list.slice(0, 4),
						list.slice(4),
						[`${get.translation(player)}的手牌`, cards],
					]);
					const result = await next.forResult();
					if (!result?.bool || !result.moved?.length) {
						return;
					}
					for (let i = 0; i < 7; i++) {
						const tag = `ql_pipa_yinyun${i}`;
						player.removeGaintag(tag);
					}
					const tagCards = result.moved.slice(0, 7).flat();
					get.info("ql_pipa").addTag(player, tagCards);
					return;
				}
				default: {
					const num1 = player.maxHp - 7;
					if (num1 > 0) {
						await player.loseMaxHp(num1);
					} else if (num1 < 0) {
						await player.gainMaxHp(-num1);
					}
					const num2 = player.getHp() - 7;
					if (num2 > 0) {
						await player.loseHp(num2);
					} else if (num2 < 0) {
						await player.recover(-num2);
					}
					await player.draw(7);
					get.info("ql_pipa").addTag(player, player.getCards("h"));
					return;
				}
			}
		},
		init(player, skill) {
			player.addSkill(`${skill}_update`);
		},
		onremoev(player, skill) {
			player.removeSkill(`${skill}_update`);
		},
		group: ["ql_pipa_defend", "ql_pipa_attack", "ql_pipa_die"],
		subSkill: {
			die: {
				trigger: {
					player: "dieBegin",
				},
				forced: true,
				locked: true,
				filter(event, player) {
					return player.hp > 0;
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			update: {
				trigger: {
					player: "changeHpAfter",
				},
				charlotte: true,
				marktext: "🎶",
				intro: {
					markcount(_1, player) {
						const num = 7 - player.hp;
						if (num < 7 && num >= 0) {
							return ("宫商角徵羽文武")[num];
						}
						return null;
					},
					mark(dialog, _1, player) {
						const num = 7 - player.hp;
						if (num < 7 && num >= 0) {
							const card = player.getCards("h").find(card => card.hasGaintag(`ql_pipa_yinyun${num}`));
							if (card) {
								dialog.addText("音韵牌");
								dialog.add([card]);
							}
							const infoList = lib.poptip.getInfo("pipa_yinglv").split("<br>");
							const effectList = lib.poptip.getInfo("pipa_yinyunpai").split("<br>");
							dialog.addText("当前体力效果");
							dialog.addText(`<span style='font-family:yuanli'>${infoList[num + 1].split("：")[1]}</span>`);
							dialog.addText("当前音韵效果");
							dialog.addText(`<span style='font-family:yuanli'>${effectList[num + 2].split("：")[1]}</span>`);
						} else {
							return "无效果";
						}
					},
				},
				update(player, skill) {
					const num = 7 - player.hp;
					let list = "宫商角徵羽文武".split("");
					if (num < 7 && num >= 0) {
						let str = list[num];
						const card = player.getCards("h").find(card => card.hasGaintag(`ql_pipa_yinyun${num}`));
						if (card) {
							str = `${str} ${get.translation(get.type2(card))}${get.translation(get.suit(card))}${get.translation(get.number(card))}`;
						}
						player.markSkill(skill);
						player.addTip(skill, str);
					} else {
						player.unmarkSkill(skill);
						player.removeTip(skill);
					}
				},
				async cost(event, trigger, player) {
					get.info(event.skill).update(player, event.skill);
					if (player.hp === 1 && !player.getAllHistory("custom", evt => evt.isPipaWu).length) {
						player.getHistory("custom").push({ isPipaWu: true });
						await player.recoverTo(player.maxHp);
					}
				},
			},
			defend: {
				trigger: {
					player: "changeHpBegin",
				},
				filter(event, player) {
					const num = 7 - player.hp;
					if (event.num >= 0 || event.getParent().name != "damage" || num >= 7 || num < 0) {
						return false;
					}
					const tag = `ql_pipa_yinyun${num}`,
						card = player.getCards("h").find(card => card.hasGaintag(tag)),
						evt = event.getParent();
					if (card && evt.card && ["type2", "suit", "number"].every(key => get[key](card) != get[key](evt.card))) {
						return true;
					}
					return !get.info("ql_pipa").filterDamage[num](evt, player);
				},
				forced: true,
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			attack: {
				trigger: {
					source: "damageBegin1",
					player: "useCard",
				},
				filter(event, player) {
					if (event.name == "damage") {
						const evt = event.getParent("useCard", true, true);
						return evt?.isExtraDamageByPipa && evt.card == event.card;
					}
					const info = get.info("ql_pipa").attackEffect;
					for (let i = 0; i < 7; i++) {
						const infox = info[i];
						if (infox.filter && !infox.filter(event, player)) {
							continue;
						}
						const card = player.getCards("h").find(card => card.hasGaintag(`ql_pipa_yinyun${i}`));
						if (card && ["type2", "suit", "number"].some(key => get[key](card) == get[key](event.card))) {
							return true;
						}
					}
					return false;
				},
				locked: true,
				async cost(event, trigger, player) {
					if (trigger.name == "damage") {
						trigger.num++;
						return;
					}
					event.result = {
						bool: true,
					};
				},
				async content(event, trigger, player) {
					const info = get.info("ql_pipa").attackEffect;
					for (let i = 0; i < 7; i++) {
						const infox = info[i];
						if (infox.filter && !infox.filter(trigger, player)) {
							continue;
						}
						const card = player.getCards("h").find(card => card.hasGaintag(`ql_pipa_yinyun${i}`));
						if (card && ["type2", "suit", "number"].some(key => get[key](card) == get[key](trigger.card))) {
							game.log(player, "执行了音韵效果", `#r${lib.poptip.getInfo("pipa_yinyunpai").split("<br>")[i + 2].split("<li>")[1]}`);
							await infox.effect(trigger, player);
						}
					}
				},
			},
		},
		attackEffect: [
			{
				async effect(event, player) {
					event.set("isExtraDamageByPipa", true);
				},
			},
			{
				filter(event, player) {
					return ["trick", "basic"].includes(get.type(event.card)) && event.targets?.length;
				},
				async effect(event, player) {
					event.effectCount++;
				},
			},
			{
				filter(event, player) {
					return game.hasPlayer(current => {
						const pos = current == player ? "ej" : "hej";
						return current.countGainableCards(player, pos);
					});
				},
				async effect(event, player) {
					const targets = game.filterPlayer(current => {
						const pos = current == player ? "ej" : "hej";
						return current.countGainableCards(player, pos);
					});
					if (!targets?.length) {
						return;
					}
					const result = targets.length > 1 ? await player
						.chooseTarget("获得一名角色区域里一张牌", true, (card, player, target) => {
							return get.event().targetx.includes(target);
						})
						.set("targetx", targets)
						.set("ai", target => {
							const player = get.player();
							return get.effect(target, { name: "shunshou" }, player, player);
						})
						.forResult() : {
						bool: true,
						targets: targets,
					};
					if (result?.bool && result.targets?.length) {
						const target = result.targets[0];
						player.line(target);
						const pos = target == player ? "ej" : "hej";
						await player.gainPlayerCard(target, pos, true);
					}
				},
			},
			{
				async effect(event, player) {
					const cards = [];
					while (cards.length < 3) {
						const card = get.cardPile(card => !cards.includes(card) && get.tag(card, "damage"));
						if (card) {
							cards.add(card);
						} else {
							break;
						}
					}
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				},
			},
			{
				async effect(event, player) {
					if (event.addCount !== false) {
						const name = event.card.name,
							stat = event.player.getStat().card;
						if (typeof stat[name] == "number" && stat[name] > 0) {
							stat[name]--;
						}
					}
				},
			},
			{
				filter(event, player) {
					return player.countCards("h", card => get.type(card) == "basic");
				},
				async effect(event, player) {
					const cards = [],
						num = player.countCards("h", card => get.type(card) == "basic");
					while (cards.length < num) {
						const card = get.cardPile(card => !cards.includes(card) && get.type2(card) == "trick");
						if (card) {
							cards.add(card);
						} else {
							break;
						}
					}
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				},
			},
			{
				filter(event, player) {
					return game.hasPlayer(current => current != player);
				},
				async effect(event, player) {
					const targets = game.filterPlayer(current => {
						return current != player;
					});
					if (!targets?.length) {
						return;
					}
					const result = targets.length > 1 ? await player
						.chooseTarget("对一名其他角色造成2点伤害", true, (card, player, target) => {
							return get.event().targetx.includes(target);
						})
						.set("targetx", targets)
						.set("ai", target => {
							const player = get.player();
							return get.damageEffect(target, player, player);
						})
						.forResult() : {
						bool: true,
						targets: targets,
					};
					if (result?.bool && result.targets?.length) {
						const target = result.targets[0];
						player.line(target);
						await target.damage(2, player);
					}
				},
			}
		],
		filterDamage: [
			function (event, player) {
				return true;
			},
			function (event, player) {
				return event.hasNature() && !event.notLink();
			},
			function (event, player) {
				return player.getAllHistory("damage").indexOf(event) >= 3;
			},
			function (event, player) {
				if (!event.source?.isIn()) {
					return false;
				}
				return event.source.getAllHistory("gain").reduce((sum, evt) => sum + evt.cards?.length || 0, 0) < 40;
			},
			function (event, player) {
				if (!event.source?.isIn()) {
					return false;
				}
				return event.num === 1 && !event.source.inRange(player);
			},
			function (event, player) {
				if (!event.source?.isIn()) {
					return false;
				}
				const getN = current => current.getSkills(null, false, false).filter(skill => {
					const info = get.info(skill);
					if (!info || info.charlotte) {
						return false;
					}
					return true;
				}).length;
				return event.source != _status.currentPhase && getN(event.source) == getN(player);
			},
			function (event, player) {
				if (!event.source?.isIn() || event.source.maxHp >= player.maxHp) {
					return false;
				}
				const evt = event.getParent("phase", true, true);
				return evt?.skill;
			},
		],
		addTag(player, cards) {
			let list = "宫商角徵羽文武".split("");
			for (let i = 0; i < cards.length; i++) {
				if (i >= list.length) {
					break;
				}
				const tag = game.addTempTag(`ql_pipa_yinyun${i}`, `音韵·${list[i]}`);
				player.addGaintag(cards[i], tag);
			}
			get.info("ql_pipa_update").update(player, "ql_pipa_update");
		},
		mod: {
			cardUsable(card, player) {
				const num = 7 - player.hp;
				if (num == 4) {
					return Infinity;
				}
			},
			targetInRange(card, player) {
				const num = 7 - player.hp;
				if (num == 4) {
					return true;
				}
			},
			ignoredHandcard(card, player) {
				const tags = card?.gaintag || [];
				if (tags.length && tags.some(tag => tag.startsWith("ql_pipa_yinyun"))) {
					return true;
				}
			},
			cardEnabled(card) {
				const evt = _status.event?.getParent("chooseToUse", true, true);
				if (evt?.skill == "ql_zhuanzhou_backup") {
					return;
				}
				const cards = [card];
				if (Array.isArray(card?.cards)) {
					cards.addArray(card.cards);
				}
				if (cards.length && cards.some(card => {
					if (get.itemtype(card) !== "card") {
						return false;
					}
					const tags = card?.gaintag || [];
					return tags.length && tags.some(tag => tag.startsWith("ql_pipa_yinyun"));
				})) {
					return false;
				}
			},
			cardSavable(card) {
				return lib.skill.ql_pipa.mod.cardEnabled.apply(this, arguments);
			},
			cardRespondable(card) {
				return lib.skill.ql_pipa.mod.cardEnabled.apply(this, arguments);
			},
			cardRecastable(card) {
				return lib.skill.ql_pipa.mod.cardEnabled.apply(this, arguments);
			},
			canBeGained(card) {
				return lib.skill.ql_pipa.mod.cardEnabled.apply(this, arguments);
			},
			canBeDiscarded(card) {
				return lib.skill.ql_pipa.mod.cardEnabled.apply(this, arguments);
			},
			cardDiscardable(card) {
				return lib.skill.ql_pipa.mod.cardEnabled.apply(this, arguments);
			},
			cardGiftable(card) {
				return lib.skill.ql_pipa.mod.cardEnabled.apply(this, arguments);
			},
		},
	},
	ql_raoliang: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: "damageBegin4",
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		filter(event, player) {
			if (get.translation(player).indexOf("琵琶") < 0) {
				return false;
			}
			return event.num > 1;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const { targets: [target] } = event;
			trigger.cancel();
			await target.loseHp(trigger.num);
			await player.draw(trigger.num);
		},
		//global: "ql_raoliang_global",
		subSkill: {
			global: {
				trigger: {
					player: "damageBegin4",
				},
				filter(event, player) {
					if (get.translation(player).indexOf("琵琶") < 0) {
						return false;
					}
					if (event.num <= 1) {
						return false;
					}
					return game.hasPlayer(current => current.hasSkill("ql_raoliang"));
				},
				async cost(event, trigger, player) {
					const targets = game.filterPlayer(current => current.hasSkill("ql_raoliang"));
					if (targets.length > 1) {
						event.result = await player
							.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
								return get.event().targetx.includes(target);
							})
							.set("targetx", targets)
							.set("ai", target => {
								return get.attitude(get.player(), target);
							})
							.forResult();
					} else {
						event.result = await player
							.chooseBool(get.prompt2(event.skill, targets[0]))
							.set("choice", get.attitude(player, targets[0]) > 0)
							.forResult();
						event.result.targets = targets;
					}
				},
				async content(event, trigger, player) {
					trigger.cancel();
					await player.loseHp(trigger.num);
					const { targets: [target] } = event;
					await target.draw(trigger.num);
				},
			},
		},
	},
	ql_zhuanzhou: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: "phaseBegin",
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		logTarget: "player",
		filter(event, player) {
			if (get.translation(player).indexOf("琵琶") < 0) {
				return false;
			}
		},
		async content(event, trigger, player) {
			const { targets: [target] } = event;
			await player.draw(player.getDamagedHp() + 1);
			const result = await player
				.chooseButton([
					"转轴：选择一项",
					[
						[
							["show", "展示一张手牌，并视为使用一张花色和点数视为与此牌相同的基本或普通锦囊牌"],
							["draw", `令${get.translation(target)}摸三张牌，其本回合使用牌不可被你以外的角色响应，且使用${get.poptip("pipa_yinyunpai")}时你可令其执行对应音韵效果`],
						],
						"textbutton",
					]
				], true)
				.set("ai", button => {
					return get.event().eff == button.link ? 1 : 0;
				})
				.set("eff", (() => {
					if (target == player || get.attitude(player, target) <= 0) {
						return "show";
					}
					return "draw";
				})())
				.forResult();
			if (!result?.bool || !result.links?.length) {
				return;
			}
			switch (result.links[0]) {
				case "show": {
					const list = get.inpileVCardList(info => {
						if (!["basic", "trick"].includes(info[0])) {
							return false;
						}
						const card = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
						return player.hasUseTarget(card);
					});
					if (!list.length) {
						return;
					}
					const result2 = await player
						.chooseButton(["选择要视为使用的牌", [list, "vcard"]], true)
						.set("ai", button => {
							const player = get.player(),
								card = get.autoViewAs({ name: button.link[2], nature: button.link[3], isCard: true });
							return player.getUseValue(card);
						})
						.forResult();
					if (!result2?.bool || !result2.links?.length) {
						return;
					}
					const card = {
						name: result2.links[0][2],
						nature: result2.links[0][3],
						isCard: true,
					};
					game.broadcastAll(card => {
						lib.skill.ql_zhuanzhou_backup.viewAs = card;
						lib.skill.ql_zhuanzhou_backup.prompt = `转轴：展示一张牌并视为使用${get.translation(card)}`;
					}, card);
					const next = player.chooseToUse();
					next.set("openskilldialog", `转轴：展示一张牌并视为使用${get.translation(card)}`);
					next.set("norestore", true);
					next.set("addCount", false);
					next.set("_backupevent", "ql_zhuanzhou_backup");
					next.set("custom", {
						add: {},
						replace: { window() { } },
					});
					next.backup("ql_zhuanzhou_backup");
					await next;
					return;
				}
				case "draw": {
					await target.draw(3);
					target.addTempSkill("ql_zhuanzhou_effect");
					target.markAuto("ql_zhuanzhou_effect", player);
					return;
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				trigger: {
					player: "useCard",
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const list = player.getStorage(event.name),
						targets = game.filterPlayer(current => !list.includes(current));
					if (targets?.length) {
						trigger.directHit.addArray(targets);
					}
					if (!list?.length) {
						return;
					}
					const allInfo = get.info("ql_pipa").attackEffect;
					const func = async target => {
						if (!target?.isIn()) {
							return;
						}
						const list = [];
						for (let i = 0; i < 7; i++) {
							const infox = allInfo[i];
							if (infox.filter && !infox.filter(trigger, player)) {
								continue;
							}
							const card = target.getCards("h").find(card => card.hasGaintag(`ql_pipa_yinyun${i}`));
							if (card && ["type2", "suit", "number"].some(key => get[key](card) == get[key](trigger.card))) {
								list.add(i);
							}
						}
						const promptList = lib.poptip.getInfo("pipa_yinyunpai").split("<br>").map(i => i.split("<li>")[1]).slice(2);
						const result = await target
							.chooseBool(`是否令${get.translation(player)}触发音韵效果？`, list.map(i => promptList[i]).join("<br>"))
							.set("choice", get.attitude(target, player) > 0)
							.forResult();
						if (result?.bool) {
							target.line(player);
							for (const i of list) {
								game.log(target, "令", player, "执行了音韵效果", `#r${promptList[i]}`);
								await allInfo[i].effect(trigger, player);
							}
						}
					};
					await game.doAsyncInOrder(list, func);
				},
			},
			backup: {
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				viewas: {
					name: "sha",
					cards: [],
				},
				position: "he",
				selectCard: 1,
				check: card => 7 - get.value(card),
				popname: true,
				ignoreMod: true,
				log: false,
				async precontent(event, trigger, player) {
					const card = event.result.cards[0];
					await player.showCards(card, `${get.translation(player)}发动了【转轴】`);
					const viewAs = get.autoViewAs({
						name: event.result.card.name,
						nature: event.result.card.nature,
						suit: get.suit(card),
						number: get.number(card),
						isCard: true,
					});
					event.result.card = viewAs;
					event.result.cards = [];
				},
			},
		},
	},
	ql_fangrui: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter"],
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		getIndex(event, player) {
			const num = 7 - player.hp;
			if (num < 0 || num >= 7) {
				return false;
			}
			if (event.name.indexOf("lose") == 0) {
				if (event.getlx === false || event.position != ui.discardPile) {
					return [];
				}
			} else {
				const evt = event.getParent();
				if (evt.relatedEvent && evt.relatedEvent.name == "useCard") {
					return [];
				}
			}
			const card = player.getCards("h").find(card => card.hasGaintag(`ql_pipa_yinyun${num}`));
			if (!card) {
				return [];
			}
			return event.cards.filter(cardx => {
				return ["type2", "suit", "number"].some(key => get[key](card) == get[key](cardx));
			})
		},
		filter(event, player, name, card) {
			if (get.translation(player).indexOf("琵琶") < 0) {
				return false;
			}
			return get.position(card) == "d";
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					return get.damageEffect(target, get.player(), get.player());
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets: [target] } = event;
			await target.damage(2, "nocard", player);
		},
	},
	//蝠桃瓶
	qlchuntao: {
		audio: "ext:五花米线/audio/skill:2",
		persevereSkill: true,
		enable: "chooseToUse",
		usable: 1,
		hiddenCard(player, name) {
			if (player.countCards("h") <= 1) {
				return false;
			}
			return get.type(name) == "trick" && lib.inpile.includes(name);
		},
		getList(event, player,) {
			const type = "trick";
			const viewAs = (info) => [{ name: info[2], nature: info[3], isCard: true, storage: { ql_chuntao: true } }];
			return get.inpileVCardList(info => {
				return info[0] == type && event.filterCard(get.autoViewAs(...viewAs(info)), player, event);
			})
		},
		filter(event, player) {
			if (player.countCards("h") <= 1) {
				return false;
			}
			return get.info("qlchuntao").getList(event, player,).length > 0
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.info("qlchuntao").getList(event, player,);
				return ui.create.dialog("春桃", [list, "vcard"], "hidden");
			},
			check(button) {
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				const diff = {
					filterCard: true,
					selectCard() {
						return get.player().countCards("h") - 1
					},
					position: "hes",
				}
				return {
					...diff,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: false,
						storage: { ql_chuntao: true }
					},
					log: false,
					async precontent(event, trigger, player) {
						const skill = "qlchuntao";
						player.logSkill(skill);
						if (game.hasPlayer(target => target != player)) {// && target.countCards("h") != 1
							const base = player.maxHp;
							const prompt = `春桃：令一名其他角色手牌调整至${player.maxHp}`;
							const result = await player
								.chooseTarget(prompt, true, lib.filter.notMe)
								.set("ai", target => {
									return get.sgnAttitude(get.player(), target) * (get.event().base - target.countCards("h"))
								})
								.set("base", base)
								.forResult();
							let { targets } = result;
							player.line(targets);
							await game.doAsyncInOrder(targets, async target => {
								const num = base - target.countCards("h");
								if (num > 0) {
									return target.draw(num);
								}
								else {
									return target.chooseToDiscard("h", -num, true);
								}
							}, () => false)
						}
					}
				};
			},
			prompt(links, player) {
				const card = `${get.translation(links[0][3]) || ""}【${get.translation(links[0][2])}】`;
				return `将${get.cnNumber(player.countCards("h") - 1)}张牌当作${card}使用`;
			},
		},
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.ql_chuntao) {
					return Infinity;
				}
			}
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					const bool = player.storage.ql_chuntao;
					const base = !bool ? 1 : player.maxHp;
					return Math.max(...game.filterPlayer(target => target != player).map(target => get.sgnAttitude(player, target) * (base - target.countCards("h"))));
				},
			},
			tag: {
				recover: 1,
				save: 1,
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	ql_chuntao: {
		audio: "ext:五花米线/audio/skill:2",
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage) {
				if (!storage) {
					return "你需要使用普通锦囊牌时，若你手牌数大于1，你可以令一名其他角色将手牌调整至一张，然后你将你手牌数-1张牌当一张普通锦囊牌使用";
				}
				return "你需要使用基本牌时，若你手牌数小于体力上限，你可以与一名其他角色将手牌调整至你体力上限，然后你视为使用之";
			},
		},
		persevereSkill: true,
		enable: "chooseToUse",
		hiddenCard(player, name) {
			const bool = !!player.storage.ql_chuntao;
			const type = !bool ? "trick" : "basic";
			if (!bool && player.countCards("h") <= 1) {
				return false;
			}
			if (bool && player.countCards("h") >= player.maxHp) {
				return false;
			}
			return get.type(name) == type && lib.inpile.includes(name) && !player.getStorage("ql_chuntao_used").includes(bool);
		},
		getList(event, player, bool) {
			const type = !bool ? "trick" : "basic";
			const viewAs = (info) => !bool ? [{ name: info[2], storage: { ql_chuntao: true } }, "unsure"] : [{ name: info[2], nature: info[3], isCard: true, storage: { ql_chuntao: true } }];
			return get.inpileVCardList(info => {
				return info[0] == type && event.filterCard(get.autoViewAs(...viewAs(info)), player, event);
			})
		},
		filter(event, player) {
			const bool = !!player.storage.ql_chuntao;
			if (!bool && player.countCards("h") <= 1) {
				return false;
			}
			if (bool && player.countCards("h") >= player.maxHp) {
				return false;
			}
			return !player.getStorage("ql_chuntao_used").includes(bool) && get.info("ql_chuntao").getList(event, player, bool).length > 0
		},
		chooseButton: {
			dialog(event, player) {
				const bool = player.storage.ql_chuntao;
				const list = get.info("ql_chuntao").getList(event, player, bool);
				return ui.create.dialog("春桃", [list, "vcard"], "hidden");
			},
			check(button) {
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				const bool = player.storage.ql_chuntao;
				const diff = !bool ? {
					filterCard: true,
					selectCard() {
						return get.player().countCards("h") - 1
					},
					position: "hes",
				} : {
					filterCard: () => false,
					selectCard: 0,
				}
				return {
					...diff,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: bool,
						storage: { ql_chuntao: true }
					},
					log: false,
					async precontent(event, trigger, player) {
						const skill = "ql_chuntao";
						player.logSkill(skill);
						const bool = player.storage.ql_chuntao;
						player.changeZhuanhuanji(skill);
						player.addTempSkill(`${skill}_used`);
						player.markAuto(`${skill}_used`, !!bool);
						event.getParent().addCount = false;
						if (game.hasPlayer(target => target != player)) {// && target.countCards("h") != 1
							const base = !bool ? 1 : player.maxHp;
							const prompt = !bool ? `春桃：令一名其他角色手牌调整至1` : `春桃：令你与一名其他角色手牌调整至${player.maxHp}`;
							const result = await player
								.chooseTarget(prompt, true, lib.filter.notMe)
								.set("ai", target => {
									return get.sgnAttitude(get.player(), target) * (get.event().base - target.countCards("h"))
								})
								.set("base", base)
								.forResult();
							let { targets } = result;
							player.line(targets);
							if (bool) {
								targets = [player, ...targets];
							}
							await game.doAsyncInOrder(targets, async target => {
								const num = base - target.countCards("h");
								if (num > 0) {
									return target.draw(num);
								}
								else {
									return target.chooseToDiscard("h", -num, true);
								}
							}, () => false)
						}
					}
				};
			},
			prompt(links, player) {
				const bool = player.storage.ql_chuntao;
				const card = `${get.translation(links[0][3]) || ""}【${get.translation(links[0][2])}】`;
				return !bool ? `将${get.cnNumber(player.countCards("h") - 1)}张牌当作${card}使用` : `请选择${card}的目标`;
			},
		},
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.ql_chuntao) {
					return Infinity;
				}
			}
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					const bool = player.storage.ql_chuntao;
					const base = !bool ? 1 : player.maxHp;
					return Math.max(...game.filterPlayer(target => target != player).map(target => get.sgnAttitude(player, target) * (base - target.countCards("h"))));
				},
			},
			tag: {
				recover: 1,
				save: 1,
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	ql_wangxiang: {
		audio: "ext:五花米线/audio/skill:2",
		persevereSkill: true,
		trigger: {
			global: ["phaseUseBegin", "useCardToTarget"],
		},
		filter(event, player) {
			if (event.name != "phaseUse") {
				return event.card.name == "sha";
			}
			return true;
		},
		logTarget(event, player) {
			return event.name == "phaseUse" ? event.player : event.target;
		},
		async cost(event, trigger, player) {
			const target = get.info(event.skill).logTarget(trigger, player);
			const list = [
				() => {
					return player
						.chooseToDiscard(get.prompt(event.skill, target), `弃置一张牌并令其交给你一张牌`, "he", "chooseonly")
						.set("ai", card => {
							const { target, player } = get.event();
							if (get.effect(target, { name: "shunshou_copy2", player, player }) > 0) {
								return 6 - get.value(card);
							}
							return 0;
						})
						.set("target", target)
				},
				() => {
					return player
						.chooseBool(get.prompt(event.skill, target), "摸一张牌并交给其一张牌")
						.set("choice", get.attitude(player, target) > 0)
				}
			];
			if (player.storage[event.skill]) {
				list.reverse();
			}
			const next = trigger.name == "phaseUse" ? list[0]() : list[1]();
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const { targets: [target], cards } = event;
			const list = [2, 1];
			if (cards?.length) {
				await player.discard(cards);
				if (player != target) {
					await target.chooseToGive(player, "he", true);
				}
			}
			else {
				await player.draw();
				if (player != target) {
					await player.chooseToGive(target, "he", true);
				}
			}
		},
		group: "ql_wangxiang_target",
		subSkill: {
			target: {
				audio: "ql_wangxiang",
				persevereSkill: true,
				trigger: {
					player: "useCard2",
					target: "useCardToTargeted",
				},
				filter(event, player) {
					if (!get.is.convertedCard(event.card) && !get.is.virtualCard(event.card)) {
						return false;
					}
					if (event.targets && event.targets.length > 0) {
						return true;
					}
					var info = get.info(event.card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						if (
							game.hasPlayer(function (target) {
								return !event.targets.includes(target) && lib.filter.targetEnabled2(event.card, player, target) && lib.filter.targetInRange(event.card, player, target);
							})
						) {
							return true;
						}
					}
					return false;
				},
				async cost(event, trigger, player) {
					const next = player
						.chooseTarget(get.prompt(event.skill), `为${get.translation(trigger.card)}增加或减少一个目标`, (_, player, target) => {
							const { card, targets } = get.event();
							if (targets.includes(target)) {
								return true;
							}
							return lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
						})
						.set("card", trigger.card)
						.set("targets", trigger.targets)
						.set("ai", target => {
							const { card, targets } = get.event();
							const player = get.player();
							return get.effect(target, card, player, player) * (targets.includes(target) ? -1 : 1);
						});
					next.targetprompt2.push(target => {
						if (!target.classList.contains("selectable") || !get.event().targets.includes(target)) {
							return false;
						}
						return `可减少目标`;
					})
					event.result = await next.forResult();
				},
				async content(event, trigger, player) {
					const { targets, card } = trigger;
					const { targets: [target] } = event;
					if (targets.includes(target)) {
						trigger.targets.remove(target);
						game.log(target, "从", card, "的目标中移除");
					}
					else {
						trigger.targets.add(target);
						game.log(target, "成为", card, "的额外目标");
					}
					player.setStorage("ql_wangxiang", !player.storage["ql_wangxiang"]);
				},
			}
		}
	},
	//商周
	ql_chuandao: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: "roundStart",
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		filter(event, player) {
			if (get.translation(player).indexOf("十供") < 0) {
				return false;
			}
			return game.hasPlayer(current => current != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [0, 3], lib.filter.notMe)
				.set("ai", target => {
					return get.attitude(get.player(), target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets, name } = event;
			const info = get.info(name);
			for (let i = 1; i < 6; i++) {
				const content = info[`content${i}`];
				const list = [player];
				if (targets) {
					list.addArray(targets);
				}
				await game.doAsyncInOrder(list, content);
			}
			await player.addSkills("qlyinye");
		},
		async content1(player) {
			await player.gainMaxHp(player == get.player() ? 2 : 1);
		},
		async content2(player) {
			await player.recover(player == get.player() ? 2 : 1);
		},
		async content3(player) {
			await player.changeHujia(player == get.player() ? 2 : 1);
		},
		async content4(player) {
			await player.draw(player == get.player() ? 3 : 2);
		},
		async content5(player) {
			await player.addSkills("ql_shien");
		},
	},
	ql_shien: {
		trigger: {
			player: ["changeHpAfter", "changeHujiaAfter", "damageBegin4"],
		},
		superCharlotte: true,
		persevereSkill: true,
		//fixed: true,
		filter(event, player) {
			if (event.name == "damage") {
				return event.num >= player.getHp() + player.hujia;
			}
			if (event.num >= 0) {
				return false;
			}
			return event.name != "changeHujia" || player.isDamaged();
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			switch (trigger.name) {
				case "changeHp": {
					await player.changeHujia();
					return;
				}
				case "changeHujia": {
					await player.recover();
					return;
				}
				default: {
					trigger.cancel();
					await player.draw(3);
					await player.removeSkills("ql_shien");
					await player.addTempSkills("xinkuanggu", { player: "phaseEnd" });
					return;
				}
			}
		},
	},
	ql_qilie: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: "phaseJieshuBegin",
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		filter(event, player) {
			if (get.translation(player).indexOf("十供") < 0) {
				return false;
			}
			return player.countCards("he", lib.filter.cardRecastable);
		},
		async cost(event, trigger, player) {
			const bool = game.hasPlayer2(current => current.hasHistory("damage"), true);
			const prompt = `重铸任意张牌并令等量角色各${bool ? "失去1点体力" : "增加1点护甲"}`;
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt(event.skill),
					prompt2: prompt,
					filterCard: lib.filter.cardRecastable,
					selectCard: [1, game.countPlayer(() => true)],
					position: "he",
					filterTarget: true,
					selectTarget() {
						return ui.selected.cards.length;
					},
					valueTargets: game.filterPlayer(current => {
						if (bool) {
							return get.effect(current, { name: "losehp" }, player, player) > 0;
						}
						return get.attitude(player, current) > 0;
					}),
					complexCard: true,
					ai1(card) {
						const { player, valueTargets } = get.event();
						if (ui.selected.cards.length >= valueTargets.length) {
							return 0;
						}
						return 10 - get.value(card);
					},
					ai2(target) {
						const { player, valueTargets } = get.event();
						return valueTargets.includes(target) ? 1 : 0;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const bool = game.hasPlayer2(current => current.hasHistory("damage"), true);
			const { cards, targets } = event;
			await player.recast(cards);
			if (bool) {
				const func = async target => await target.loseHp();
				await game.doAsyncInOrder(targets, func);
			} else {
				const func = async target => await target.changeHujia();
				await game.doAsyncInOrder(targets, func);
			}
		},
	},
	ql_shibiao: {
		trigger: {
			global: ["damageEnd", "damageSource"],
		},
		filter(event, player, name) {
			if (get.translation(player).indexOf("十供") < 0) {
				return false;
			}
			const target = get.info("ql_shibiao").logTarget(event, player, name);
			if (!target?.isIn() || target == _status.currentPhase) {
				return false;
			}
			return target.hasSkill("ql_shien", null, null, false) && target != player;
		},
		logTarget(event, player, name) {
			return event[name == "damageEnd" ? "player" : "source"];
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			const { targets: [target], name } = event;
			const list = get.inpileVCardList(info => {
				if (info[0] == "equip" || info[3]) {
					return false;
				}
				return !player.getStorage(name).includes(info[2]);
			});
			if (list?.length) {
				const result = await player
					.chooseButton(["师表：记录一个牌名", [list, "vcard"]], true)
					.forResult();
				if (result?.bool && result.links?.length) {
					const card = result.links[0][2];
					player.markAuto(name, card);
					game.log(player, "记录了牌名", `#y${get.translation(card)}`);
				}
			}
			const func = async current => {
				const targetx = current == player ? target : player;
				if (current.countGainableCards(targetx, "he")) {
					game.addGlobalSkill(`${name}_viewas`);
					const tag = `${name}_${player.playerid}`;
					game.addTempTag(tag, `师表·${get.translation(player.name)}`);
					const next = current.chooseToGive(targetx, "he", true);
					next.gaintag.add(tag);
					await next;
				}
				await current.draw(2);
			};
			await game.doAsyncInOrder([player, target], func);
			const target2 = trigger[event.triggername == "damageEnd" ? "source" : "player"];
			if (target2?.isIn()) {
				const result = await player
					.chooseBool(`是否对${get.translation(target2)}造成1点伤害？`)
					.set("choice", get.damageEffect(target2, player, player) > 0)
					.forResult();
				if (result?.bool) {
					player.line(target2);
					await target2.damage(player);
				}
			}
		},
		subSkill: {
			viewas: {
				enable: "chooseToUse",
				onChooseToUse(event) {
					if (event.online) {
						return;
					}
					const map = new Map();
					game.countPlayer2(current => {
						const list = current.getStorage("ql_shibiao");
						if (!list?.length) {
							return false;
						}
						map.set(current, list);
					}, true);
					event.set("shibiaoMap", map);
				},
				filter(event, player) {
					const map = event.shibiaoMap || new Map();
					if (!map.size) {
						return false;
					}
					return Array.from(map.keys()).some(current => {
						const tag = `ql_shibiao_${current.playerid}`;
						if (!player.countCards("h", card => card.hasGaintag(tag))) {
							return false;
						}
						const list = map.get(current);
						return list.some(name => {
							const card = get.autoViewAs({ name: name }, "unsure");
							return event.filterCard?.(card, player, event);
						});
					});
				},
				chooseButton: {
					dialog(event, player) {
						const map = event.shibiaoMap,
							targets = Array.from(map.keys());
						const dialog = ui.create.dialog("师表", "hidden");
						for (const target of targets) {
							const tag = `ql_shibiao_${target.playerid}`;
							if (!player.countCards("h", card => card.hasGaintag(tag))) {
								continue;
							}
							dialog.add(get.translation(tag));
							dialog.add([
								map.get(target).map(name => [name, tag]),
								(item, type, position, noclick, node) => {
									const [name, tag] = item;
									node = ui.create.buttonPresets.vcard(name, type, position, noclick);
									node.node.range.innerHTML = get.translation(tag);
									node.node.range.style.bottom = "2.5px";
									node.node.range.style.width = "100%";
									node.node.range.style.right = "0%";
									node.node.range.style.textAlign = "center";
									node._link = node.link = item;
									return node;
								},
							]);
						}
						dialog.direct = true;
						return dialog;
					},
					check(button) {
						if (get.event().getParent().type != "phase") {
							return 1;
						}
						const card = get.autoViewAs({ name: button.link[0] }, "unsure"),
							player = get.player();
						return player.getUseValue(card);
					},
					prompt(links, player) {
						const [name, tag] = links[0];
						return `将一张${get.translation(tag)}牌当作${get.translation(name)}使用`;
					},
					backup(links, player) {
						const [name, tag] = links[0];
						return {
							tag: tag,
							filterCard(card) {
								const { tag } = get.info("ql_shibiao_viewas_backup");
								return get.itemtype(card) == "card" && card.hasGaintag(tag);
							},
							viewAs: {
								name: name,
							},
							audio: "ql_shibiao",
							popname: true,
						};
					},
				},
				ai: {
					order: 1,
					result: {
						player(player) {
							if (_status.event.dying) {
								return get.attitude(player, _status.event.dying);
							}
							return 1;
						},
					},
				},
				hiddenCard(player, name) {
					const list = [];
					game.countPlayer2(current => {
						const names = current.getStorage("ql_shibiao");
						if (names?.length && player.countCards("h", card => card.hasGaintag(`ql_shibiao_${current.playerid}`))) {
							list.addArray(names);
						}
					}, true);
					return list.includes(name);
				},
			},
			viewas_backup: {},
		},
	},
	//曹昂
	ql_zuiyuan: {
		global: "ql_zuiyuan_global",
		subSkill: {
			used: {
				charlotte: true,
				intro: {
					content: "本回合已发动过",
				},
				mark: true,
			},
			global: {
				enable: "chooseToUse",
				viewAsFilter(player) {
					return player.countDiscardableCards(player, "he") > 0 && game.hasPlayer(target => target.hasSkill("ql_zuiyuan") && !target.hasSkill("ql_zuiyuan_used"));
				},
				filterCard: lib.filter.cardDiscardable,
				selectCard: [1, Infinity],
				ignoreMod: true,
				filterTarget(card, player, target) {
					return target.hasSkill("ql_zuiyuan") && !target.hasSkill("ql_zuiyuan_used");
				},
				selectTarget: 1,
				viewAs: {
					name: "jiu",
					isCard: true,
					cards: [],
					storage: {
						ql_zuiyuan: true,
					}
				},
				check(card) {
					return 6 - get.value(card);
				},
				position: "he",
				prompt: "醉苑：弃置任意张牌令一名拥有【醉苑】的角色进行选择",
				async precontent(event, trigger, player) {
					const { cards, card, targets: [target] } = event.result;
					const skill = "ql_zuiyuan";
					target.logSkill(skill, player);
					target.addTempSkill(skill + "_used");
					await player.discard(cards);
					const choice = ["选项一", "选项二", "背水！"];
					const choiceList = [
						`选项一：令${get.translation(player)}将手牌补至体力上限`,
						`选项二：令${get.translation(player)}视为使用一张不计入次数且无次数限制的【酒】`,
						`背水：你摸两张牌，若${get.translation(player)}弃置牌数小于3且其体力值大于1，其于结算后受到一点无来源伤害。`
					];
					const result = await target
						.chooseControl(choice)
						.set("choiceList", choiceList)
						.set("prompt", "醉苑：请选择一项")
						.set("displayIndex", false)
						.set("choice", (() => {
							const att = get.attitude(target, player);
							if (att > 0) {
								if (cards.length >= 3 || player.hp <= 1) {
									return 2;
								}
								return player.maxHp - player.countCards("h") > 2 ? 0 : 1;
							}
							if (player.maxHp - player.countCards("h") > 2) {
								return 1;
							}
							return 0;
						})())
						.forResult();
					game.log(target, "选择了", "#y" + result.control);
					const { index } = result;
					const evt = event.getParent();
					if (index % 2 == 0) {
						await player.drawTo(player.maxHp);
					}
					if (index > 0) {
						evt.addCount = false;
						evt.set("_backupevent", skill + "_backup");
						evt.set("openskilldialog", `请选择${get.translation(card.name)}的目标`);
						evt.backup(skill + "_backup");
						evt.set("norestore", true);
						evt.set("custom", {
							add: {},
							replace: { window() { } },
						});
					}
					if (index == 2) {
						await target.draw(2);
						if (cards.length < 3 && player.hp > 1) {
							player
								.when("useCardAfter")
								.filter(evtx => evtx.getParent() == evt)
								.step(async (event, trigger, player) => {
									await player.damage("nosource");
								});
						}
					}
					evt.goto(0);
				},
				mod: {
					cardUsable(card, player) {
						if (card.storage?.ql_zuiyuan) {
							return Infinity;
						}
					}
				},
				ai: {
					order(item, player) {
						return get.order({ name: "jiu" }, player);
					},
					result: {
						target(player, target) {
							return get.sgnAttitude(player, target);
						}
					}
				}
			},
			backup: {
				filterCard: () => false,
				selectCard: 0,
				log: false,
				viewAs: {
					name: "jiu",
					isCard: true,
					cards: [],
					storage: {
						ql_zuiyuan: true,
					}
				},
			}
		},
	},
	ql_chengyi: {
		forced: true,
		init(player, skill) {
			if (game.online) {
				return;
			}
			const list = [get.info(skill).derivation[game.roundNumber % 2]];
			player.addAdditionalSkill(skill, list);
		},
		onremove(player, skill) {
			player.removeAdditionalSkill(skill);
		},
		popup: false,
		derivation: ["fangzhu", "olchengxiang"],
		trigger: {
			global: "roundStart",
		},
		async content(event, trigger, player) {
			get.info(event.name).init(player, event.name);
		}
	},
	//十二花卉杯
	ql_jishi: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: ["phaseZhunbeiBegin", "phaseJieshuBegin", "turnOverAfter"],
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		filter(event, player) {
			if (get.translation(player).indexOf("十二") < 0) {
				return false;
			}
			if (event.name == "phaseZhunbei") {
				return true;
			}
			if (event.player == player || player.getCards("he").reduce((sum, card) => sum + get.number(card), 0) < 12) {
				return false;
			}
			return event.name == "phaseJieshu" || !event.player.isTurnedOver();
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phaseZhunbei") {
				event.result = {
					bool: true,
				};
				return;
			}
			const prompt = "弃置任意张点数之和大于12的牌，对其造成1点伤害";
			event.result = await player
				.chooseToDiscard(`###${get.prompt(event.skill, trigger.player)}###${prompt}`, "he")
				.set("complexCard", true)
				.set("selectCard", () => {
					const num = ui.selected.cards.reduce((sum, card) => sum + get.number(card), 0),
						count = ui.selected.cards.length;
					if (num < 12) {
						return count + 2;
					}
					return [count, count + 1];
				})
				.set("ai", card => {
					if (get.event().eff <= 0) {
						return 0;
					}
					const num = ui.selected.cards.reduce((sum, card) => sum + get.number(card), 0);
					if (num + get.number(card) === 12) {
						return 15 - get.value(card);
					}
					return 10 - get.value(card);
				})
				.set("eff", get.damageEffect(trigger.player, player, player))
				.forResult();
			event.result.targets = [trigger.player];
		},
		async content(event, trigger, player) {
			if (trigger.name == "phaseZhunbei") {
				if (player.maxHp < 12) {
					await player.gainMaxHp(12 - player.maxHp);
				}
				if (player.getHp() < 12) {
					await player.recoverTo(12);
				}
				if (player.countCards("h") < 12) {
					await player.drawTo(12);
				}
				player.addTempSkill(`${event.name}_effect`);
				return;
			}
			const { cards, targets: [target] } = event;
			await player.modedDiscard(cards);
			let num = 1;
			if (cards.reduce((sum, card) => sum + get.number(card), 0) === 12) {
				num++;
			}
			if (player.getHp() >= player.getDamagedHp()) {
				await player.loseHp();
				num++;
			} else {
				await player.draw(2);
				await player.recover();
			}
			await target.damage(num);
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: {
					global: ["loseAfter", "equipAfter", "loseAsyncAfter", "cardsDiscardAfter"],
				},
				getIndex(event, player) {
					return event.getd?.().filter(card => get.number(card, false) === 12) || [];
				},
				filter(event, player, name, card) {
					return get.number(card, false) === 12;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.loseHp();
				},
			},
		},
	},
	ql_yueling: {
		audio: "ext:五花米线/audio/skill:3",
		trigger: {
			global: "loseHpAfter",
		},
		getIndex(event) {
			return event.num;
		},
		filter(event, player) {
			if (get.translation(player).indexOf("十二") < 0) {
				return false;
			}
			return event.num > 0;
		},
		onremove(player, skill) {
			player.removeTip(skill);
		},
		intro: {
			markcount(_1, player) {
				return player.getAllHistory("gain", evt => {
					const evtx = evt.getParent();
					return evtx.name == "draw" && !evtx.byYueling && evtx.getParent().name == "ql_yueling";
				}).length;
			},
			content(_1, player) {
				const num = player.getAllHistory("gain", evt => {
					const evtx = evt.getParent();
					return evtx.name == "draw" && !evtx.byYueling && evtx.getParent().name == "ql_yueling";
				}).length;
				return `已通过【月令】摸牌数：${num}`;
			},
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		forced: true,
		async content(event, trigger, player) {
			await player.draw();
			const num = player.getAllHistory("gain", evt => {
				const evtx = evt.getParent();
				return evtx.name == "draw" && !evtx.byYueling && evtx.getParent().name == event.name;
			}).length;
			player.addTip(event.name, `月令 ${num}`);
			player.markSkill(event.name);
			for (const key of [2, 3, 4, 6]) {
				if (num % key === 0) {
					await get.info(event.name)[`content${key}`](player);
				}
			}
		},
		async content2(player) {
			await player.draw().set("byYueling", true);
		},
		async content3(player) {
			await player.recover();
		},
		async content4(player) {
			const targets = game.filterPlayer(() => true);
			if (targets?.length) {
				const result = targets.length > 1 ? await player
					.chooseTarget("月令：对一名角色造成1点伤害", true)
					.set("ai", target => {
						const player = get.player();
						return get.damageEffect(target, player, player);
					})
					.forResult() : {
					bool: true,
					targets: targets,
				};
				if (result?.bool && result.targets?.length) {
					const { targets: [target] } = result;
					player.line(target);
					await target.damage(player);
				}
			}
		},
		async content6(player) {
			const func = async target => {
				const result = await target
					.chooseButton([
						"获得一种类型的牌",
						[
							["basic", "trick", "equip"].map(type => ["", "", `caoying_${type}`]),
							"vcard",
						],
					], true)
					.set("ai", () => Math.random())
					.forResult();
				if (result?.bool && result.links?.length) {
					const card = get.cardPile(card => get.type2(card, false) == result.links[0][2].slice(8));
					if (card) {
						await player.gain(card, "gain2");
					}
				}
			};
			await game.doAsyncInOrder([player, player], func);
		},
	},
	ql_xiangmeng: {
		audio: "ext:五花米线/audio/skill:2",
		sunbenSkill: true,
		enable: "phaseUse",
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		filter(event, player) {
			if (get.translation(player).indexOf("十二") < 0) {
				return false;
			}
			if (!game.hasPlayer(current => current != player)) {
				return false;
			}
			return player.getCards("he").map(card => get.color(card)).toUniqued().length > 1;
		},
		filterCard(card, player) {
			if (!lib.filter.cardDiscardable(card, player, "ql_xiangmeng")) {
				return false;
			}
			return ui.selected.cards.every(cardx => get.color(cardx) != get.color(card));
		},
		position: "he",
		selectCard: 2,
		complexCard: true,
		check(card) {
			return 10 - get.value(card);
		},
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target, name } = event;
			player.awakenSkill(name);
			await target.turnOver();
			const skill = `${name}_effect`;
			player.addSkill(skill);
			player.markAuto(skill, target);
			player.addTip(skill, player.getStorage(skill).map(current => `香梦 ${get.translation(current)}`).join("\n"));
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: {
					global: ["damageEnd", "dieAfter"],
				},
				intro: {
					content: "香梦选中的目标：$",
				},
				filter(event, player) {
					return player.getStorage("ql_xiangmeng_effect").includes(event.player);
				},
				forced: true,
				locked: false,
				logTarget: "player",
				async content(event, trigger, player) {
					const { name, targets: [target] } = event;
					if (trigger.name == "damage") {
						await target.loseHp(trigger.num);
						return;
					}
					await player.gainMaxHp();
					await player.draw(2);
					await player.turnOver(false);
					await player.link(false);
					const list = [];
					for (let i = 1; i < 6; i++) {
						for (let j = 0; j < player.countDisabledSlot(i); j++) {
							list.push(i);
						}
					}
					if (list.length > 0) {
						await player.enableEquip(list);
					}
					const skill = name.slice(0, -7);
					player.insertPhase(skill);
					player.unmarkAuto(name, target);
					const marks = player.getStorage(name);
					if (marks.length) {
						player.addTip(name, marks.map(current => `香梦 ${get.translation(current)}`).join("\n"));
					} else {
						player.removeTip(name);
					}
					if (player.hasSkill(skill, null, null, false) && !player.hasSkill(skill)) {
						player.popup("香梦");
						player.restoreSkill(skill);
						game.log(player, "恢复了技能", "#g【香梦】");
					}
				},
			},
		},
		ai: {
			order: 24,
			result: {
				target: -4,
			},
		},
	},
	//鸟尊
	ql_xunji: {
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			if (!event.cards?.someInD("od")) {
				return false;
			}
			const bool = card => (get.tag(card, "damage") > 0) === (get.tag(event.card, "damage") > 0);
			const num1 = player.countCards("h", bool),
				num2 = player.countCards("h", card => !bool(card));
			return num1 < num2;
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseControl("牌堆顶", "弃牌堆顶", "cancel2")
				.set("prompt", get.prompt2(event.skill))
				.set("ai", () => get.rand(0, 1))
				.forResult();
			if (result.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: result.control,
				};
			}
		},
		async content(event, trigger, player) {
			const cards = trigger.cards.filterInD("od"),
				bool = get.tag(trigger.card, "damage") > 0;
			if (!cards.length) {
				return;
			}
			const pile = event.cost_data;
			const result = cards.length > 1 ? await player
				.chooseToMove(`寻迹：将牌按顺序置于${pile}`, true)
				.set("list", [[`${pile}顶`, cards]])
				.set("processAI", function (list) {
					const cards = list[0][1].slice(0);
					cards.sort((a, b) => {
						return get.value(b) - get.value(a);
					});
					return [cards];
				})
				.forResult() : {
				bool: true,
				moved: [cards],
			};
			if (!result?.bool || !result.moved.length) {
				return;
			}
			const put = result.moved[0].reverse(),
				bool2 = pile === "牌堆顶",
				cardpile = ui[bool2 ? "cardPile" : "discardPile"];
			for (let i = 0; i < put.length; i++) {
				cardpile.insertBefore(put[i], cardpile.firstChild);
			}
			game.updateRoundNumber();
			game.log(player, "将", put, `置于了${pile}`);
			const next = game.createEvent("cardsGotoDiscardPile", false);
			next.player = player;
			next.cards = put;
			next.getd = function () {
				return this.cards;
			};
			next.setContent("emptyEvent");
			game.getGlobalHistory().cardMove.push(next);
			await next;
			await game.delayx();
			const card = get.cardPile(card => bool !== (get.tag(card, "damage") > 0), bool2 ? "discardPile" : "cardPile");
			if (card) {
				await player.gain(card, "gain2");
			}
		},
	},
	ql_kanpo: {
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		forced: true,
		filter(event, player) {
			const evt = event.getParent(),
				list = evt.phaseList?.slice(evt.num);
			return list?.length && list.some(phase => phase.startsWith("phaseDraw"));
		},
		async content(event, trigger, player) {
			const evt = (trigger || event).getParent("phase", true);
			if (evt?.phaseList?.length) {
				for (let num = evt.num + 1; num < evt.phaseList.length; num++) {
					const phase = evt.phaseList[num];
					if (phase.startsWith("phaseDraw")) {
						evt.phaseList[num] = `skipDraw-ql_kanpo`;
					}
				}
			}
			const cards = get.cards(8);
			await game.cardsGotoOrdering(cards);
			const next = player.chooseToMove_new("勘破", true);
			next.set("list", [
				["观看牌", cards],
				[["牌堆顶"], ["牌堆底"]],
				[["手牌"], ["弃牌堆顶"]],
			]);
			next.set("filterOk", moved => {
				return [1, 2, 3, 4].every(num => moved[num].length == 2);
			});
			next.set("filterMove", (from, to, moved) => {
				if (typeof to != "number" || to == 0) {
					return true;
				}
				return moved[to].length < 2;
			});
			next.set("processAI", list => {
				const cards = list[0][1].slice(0).randomSort();
				return [[], cards.slice(0, 2), cards.slice(2, 4), cards.slice(4, 6), cards.slice(6)];
			});
			const result = await next.forResult();
			if (!result?.bool || !result.moved?.length) {
				return;
			}
			const [_0, top, bottom, hand, discard] = result.moved;
			if (hand?.length) {
				await player.gain(hand, "gain2");
			}
			if (bottom?.length) {
				for (let i = 0; i < bottom.length; i++) {
					ui.cardPile.appendChild(bottom[i]);
				}
			}
			if (top?.length) {
				for (let i = top.length - 1; i >= 0; i--) {
					ui.cardPile.insertBefore(top[i], ui.cardPile.firstChild);
				}
			}
			if (discard?.length) {
				for (let i = discard.length - 1; i >= 0; i--) {
					ui.discardPile.insertBefore(discard[i], ui.discardPile.firstChild);
				}
				game.updateRoundNumber();
				const next = game.createEvent("cardsGotoDiscardPile", false);
				next.player = player;
				next.cards = discard;
				next.getd = function () {
					return this.cards;
				};
				next.setContent("emptyEvent");
				game.getGlobalHistory().cardMove.push(next);
				await next;
			}
			game.updateRoundNumber();
			await game.delayx();
		},
	},
	ql_jiean: {
		trigger: {
			global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter", "equipAfter", "cardsGotoDiscardPile"],
		},
		forced: true,
		filter(event, player) {
			const cards = event.getd();
			let precards = [],
				suits = cards.map(card => get.suit(card));
			let finish = false;
			game.getGlobalHistory("cardMove", function (evt) {
				if (evt.name == "lose" && evt.position != ui.discardPile) {
					return false;
				}
				suits.addArray(evt.cards.map(card => get.suit(card)));
				if (evt == event || evt.getParent() == event || precards.length >= 4) {
					finish = true;
				}
				if (finish || !["lose", "cardsDiscard", "cardsGotoDiscardPile"].includes(evt.name)) {
					return false;
				}
				precards = [...precards, ...evt.cards];
			});
			if (precards.length >= 4 || suits.toUniqued().length < 2) {
				return false;
			}
			return cards.length + precards.length >= 4;
		},
		async content(event, trigger, player) {
			const cards = trigger.getd(),
				suits = cards.map(card => get.suit(card));
			game.getGlobalHistory("cardMove", function (evt) {
				if (evt.name == "lose" && evt.position != ui.discardPile) {
					return false;
				}
				if (!["lose", "cardsDiscard", "cardsGotoDiscardPile"].includes(evt.name)) {
					return false;
				}
				suits.addArray(evt.cards.map(card => get.suit(card)));
			});
			const num = suits.toUniqued().length;
			/*if (num >= 2) {
				await player.draw(1, "bottom");
			}*/
			if (num >= 3) {
				player
					.when({
						global: "phaseJieshuBegin",
					})
					.filter(evt => evt.getParent("phase") == trigger.getParent("phase"))
					.step(async (event, trigger, player) => {
						await player.useResult({ skill: "ql_kanpo" }, event);
					})
			}
			if (num >= 4) {
				if (_status.currentPhase == player) {
					const targets = game.filterPlayer(() => true);
					if (!targets.length) {
						return;
					}
					const result = targets.length > 1 ? await player
						.chooseTarget("结案：对一名角色造成2点伤害", true)
						.set("ai", target => {
							const player = get.player();
							return get.damageEffect(target, player, player);
						})
						.forResult() : {
						bool: true,
						targets: targets,
					};
					if (result?.bool && result.targets?.length) {
						player.line(result.targets);
						const func = async target => {
							await target.damage(2);
						}
						await game.doAsyncInOrder(result.targets, func);
					}
				} else {
					await player.draw(2, "bottom");
				}
			}
		},
	},
	//张郃
	ql_duanyuan: {
		enable: "phaseUse",
		usable(skill, player) {
			return player.countMark("ql_duanyuan") + 1;
		},
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target, name } = event;
			const nameList = [
				["驻山", `以防止被${get.translation(target)}造成伤害并弃牌`],
				["阻道", `以防止被${get.translation(target)}跳过阶段`],
				["断水", `若成功，你跳过${get.translation(target)}下一个摸牌阶段和出牌阶段`],
				["急奔", `若成功，你对${get.translation(target)}造成1点伤害并弃置其一张牌`],
			];
			game.broadcastAll(list => {
				const list2 = ["db_atk1", "db_atk2", "db_def1", "db_def2"];
				for (var i = 0; i < 4; i++) {
					lib.card[list2[i]].image = `image/card/${list2[i]}.jpg`;
					lib.translate[list2[i]] = list[i][0];
					lib.translate[list2[i] + "_info"] = list[i][1];
				}
			}, nameList);
			const map = await game.chooseAnyOL([player, target], get.info(name).chooseButtonx, [nameList, target]).forResult();
			if (!map.has(player) || !map.has(target)) {
				return;
			}
			const result1 = map.get(player).links[0],
				result2 = map.get(target).links[0];
			const mapList = {
				"驻山": "db_atk1",
				"阻道": "db_atk2",
				"断水": "db_def1",
				"急奔": "db_def2",
			};
			player.$compare(game.createCard(mapList[result1], "", ""), target, game.createCard(mapList[result2], "", ""));
			game.log(target, "选择的策略为", "#g" + result1);
			game.log(player, "选择的策略为", "#g" + result2);
			await game.delay(0, lib.config.game_speed == "vvfast" ? 4000 : 1500);
			if (result1 === "断水" && result2 !== "阻道") {
				player.popup("胜", "wood");
				target.popup("负", "fire");
				game.log(player, "#g胜");
				target.addSkill("ql_duanyuan_skip");
				target.addMark("ql_duanyuan_skip", 1, false);
				return;
			}
			if (result1 === "急奔" && result2 !== "驻山") {
				player.popup("胜", "wood");
				target.popup("负", "fire");
				game.log(player, "#g胜");
				await target.damage();
				if (target.countDiscardableCards(player, "he")) {
					await player.discardPlayerCard(target, "he", true);
				}
				return;
			}
			if (result1 === "断水" && result2 !== "驻山") {
				target.popup("胜", "wood");
				player.popup("负", "fire");
				game.log(target, "#g胜");
				var evt = event.getParent("phaseUse");
				if (evt && evt.player == player) {
					evt.skipped = true;
					game.log(player, "结束了出牌阶段");
				}
				return;
			}
			target.popup("胜", "wood");
			player.popup("负", "fire");
			game.log(target, "#g胜");
		},
		chooseButtonx(player, list, target) {
			const nameList = player == target ? list.slice(0, 2) : list.slice(2);
			return player
				.chooseButton([
					"夺山",
					[nameList, (item, type, position, noclick, node) => {
						const map = {
							"驻山": "db_atk1",
							"阻道": "db_atk2",
							"断水": "db_def1",
							"急奔": "db_def2",
						}
						node = ui.create.buttonPresets.vcard(map[item[0]], type, position, noclick);
						node._link = node.link = item[0];
						return node;
					}]
				], true)
				.set("ai", () => 1 + Math.random());
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
		},
		subSkill: {
			skip: {
				intro: {
					content: "下#个回合开始时，跳过本回合的摸牌阶段和出牌阶段",
				},
				onremove: true,
				charlotte: true,
				trigger: {
					player: "phaseBegin",
				},
				filter(event, player) {
					return player.countMark("ql_duanyuan_skip") && event.phaseList?.length;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const { name } = event;
					player.removeMark(name, 1, false);
					if (!player.countMark(name)) {
						player.removeSkill(name);
					}
					const evt = event.getParent("phase", true);
					if (evt?.player == player) {
						for (let i = evt.num; i < evt.phaseList.length; i++) {
							const phase = evt.phaseList[i];
							for (const type of ["phaseDraw", "phaseUse"]) {
								if (phase.startsWith(type)) {
									evt.phaseList[i] = phase.replace(type, `skip${type.slice(5)}-${name}`);
								}
							}
						}
					}
				},
			},
		},
	},
	ql_fanzhan: {
		trigger: {
			player: "damageEnd",
		},
		getIndex(event) {
			return event.num;
		},
		filter(event, player) {
			return event.num > 0;
		},
		async content(event, trigger, player) {
			const { name } = event;
			if (player.countMark(name)) {
				await player.draw(player.countMark(name));
			}
			if (trigger.source?.isIn() && trigger.source.hp >= player.hp) {
				player.line(trigger.source);
				await trigger.source.damage();
			}
		},
	},
	ql_qibian: {
		trigger: {
			player: "loseAfter",
			global: ["loseAsyncAfter", "gainAfter", "equipAfter", "addToExpansionAfter", "addJudgeAfter"],
		},
		filter(event, player) {
			if (player == _status.currentPhase) {
				return false;
			}
			const evtp = event.relatedEvent || event.getParent();
			if (evtp?.name == "useCard") {
				return false;
			}
			return event.getl(player)?.cards2?.length;
		},
		frequent: true,
		async content(event, trigger, player) {
			const cards = trigger.getl(player).cards2;
			await player.showCards(cards);
			if (cards.some(card => get.type2(card) == "basic")) {
				player.addMark("ql_fanzhan", 1, false);
				game.log(player, "令", "#g【反斩】", "摸牌数+1");
			}
			if (cards.some(card => get.type2(card) == "trick")) {
				player.addMark("ql_duanyuan", 1, false);
				game.log(player, "令", "#g【断源】", "发动次数+1");
			}
			if (cards.some(card => get.type2(card) == "equip")) {
				const loses = cards.filter(card => get.type2(card) == "equip");
				const target = (() => {
					const current = game.findPlayer(current => {
						if (!current?.isIn()) {
							return false;
						}
						const evt = trigger.getg(current);
						return evt?.length && evt.containsSome(...loses);
					});
					if (current?.isIn()) {
						return current;
					}
					if (trigger.type === "discard") {
						return trigger.discarder || trigger.getParent(2).player;
					}
					return null;
				})();
				if (get.itemtype(target) == "player" && target?.isIn()) {
					player.line(target);
					const bool = target.countDiscardableCards(player, "he");
					const result = bool ? await player
						.discardPlayerCard(target, "he", `弃置${get.translation(target)}一张牌，或点取消对其造成1点伤害`)
						.set("ai", button => {
							const { eff } = get.event();
							if (eff > 0) {
								return 0;
							}
							return get.buttonValue(button);
						})
						.set("eff", get.damageEffect(target, player, player))
						.forResult() : {
						bool: false,
					};
					if (!result?.bool) {
						await target.damage();
					}
				}
			}
		},
	},
	//劳拉
	ql_bihu: {
		trigger: {
			player: "damageEnd",
		},
		filter(event, player) {
			return event.source != player;
		},
		forced: true,
		locked: false,
		getIndex: event => event.num,
		logTarget: "source",
		hasMark(player) {
			return ["thunder", "fire"].some(i => player.hasMark(`ql_bihu_${i}`));
		},
		async content(event, trigger, player) {
			const { targets: [target] } = event;
			const result = await target.judge().forResult();
			if (result.color == "red") {
				target.addMark(`${event.name}_fire`);
			}
			if (result.color == "black") {
				target.addMark(`${event.name}_thunder`);
			}
		},
		subSkill: {
			fire: {
				charlotte: true,
				onremove: true,
				marktext: "🔥",
				intro: {
					name2: "灼烧",
					content: "mark",
				}
			},
			thunder: {
				charlotte: true,
				onremove: true,
				marktext: "⚡",
				intro: {
					name2: "穿刺",
					content: "mark",
				}
			},
		},
	},
	ql_xuanji: {
		enable: "phaseUse",
		usable: 1,
		filterCard: lib.filter.cardDiscardable,
		position: "h",
		filter(event, player) {
			return player.countDiscardableCards(player, "h") > 0;
		},
		async content(event, trigger, player) {
			const num = get.rand(1, 3);
			const cards = await player.draw(num).forResult();
			if (!cards.cards.some(card => get.type(card) == "equip") && game.hasPlayer(target => target != player && target.countGainableCards(player, "e"))) {
				const result = await player
					.chooseTarget(`玄机：获得一名其他角色装备区内的一张牌`, true, (card, player, target) => {
						return target != player && target.countGainableCards(player, "e");
					})
					.forResult();
				if (result?.targets?.length) {
					const { targets: [target] } = result;
					player.line(target);
					await player.gainPlayerCard(target, "e", true);
				}
			}
		}
	},
	ql_canheng: {
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		filter(event, player, name) {
			const target = name == "damageSource" ? event.player : event.source;
			if (get.info("ql_bihu").hasMark(target)) {
				return player.countCards("h") > 0;
			}
			return true;
		},
		async cost(event, trigger, player) {
			const target = event.triggername == "damageSource" ? trigger.player : trigger.source;
			if (get.info("ql_bihu").hasMark(target)) {
				event.result = await player.chooseCard(get.prompt2(event.skill, target), "h").forResult();
			}
			else {
				event.result = {
					bool: true,
				}
			}
		},
		logTarget(event, player, name) {
			if (name == "damageSource") {
				return event.player;
			}
			return event.source;
		},
		getIndex: event => event.num,
		async content(event, trigger, player) {
			const { targets: [target] } = event;
			if (get.info("ql_bihu").hasMark(target)) {
				const { cards } = event;
				await player.showCards(cards, `${get.translation(player)}发动了【${get.translation(event.name)}】`);
				if (target.countDiscardableCards(player, "h")) {
					const result = await player.discardPlayerCard(target, "h", true).forResult();
					if (result?.cards?.length) {
						const { cards: [card] } = result;
						if (get.color(cards[0]) == get.color(card) && player.isDamaged()) {
							await player.recover();
						}
					}
				}
			}
			else {
				return;
				/*const mark = ["thunder", "fire"].randomGet();
				target.addMark(`ql_bihu_${mark}`);*/
			}
		}
	},
	ql_baopo: {
		enable: "phaseUse",
		filter(event, player) {
			return game.players.reduce((sum, target) => sum + target.countMark("ql_bihu_fire") + target.countMark("ql_bihu_thunder"), 0) >= 3;
		},
		filterTarget(card, player, target) {
			return get.info("ql_bihu").hasMark(target);
		},
		selectTarget() {
			return [1, get.player().countCards("e") + 1];
		},
		multiline: true,
		multitarget: true,
		async content(event, trigger, player) {
			const { targets } = event;
			await player.modedDiscard(player.getCards("e"));
			await game.doAsyncInOrder(targets, async target => {
				const num1 = target.countMark("ql_bihu_fire"), num2 = target.countMark("ql_bihu_thunder");
				if (num1 > 0) {
					await target.damage("fire", num1);
				}
				if (num2 > 0) {
					await target.damage("thunder", num2);
				}
			});
			game.players.forEach(target => {
				target.clearMark("ql_bihu_fire");
				target.clearMark("ql_bihu_thunder");
			})
		}
	},
	_error: {
		charlotte: true,
		superCharlotte: true,
		fixed: true,
		persevereSkill: true,
		forced: true,
		locked: true,
		trigger: {
			global: ["gainMaxHpBefore", "loseMaxHpBefore", "phaseBefore", "damageBegin1"],
		},
		filter(event, player) {
			if (!lib.config["extension_五花米线_ql_guard"]) {
				return false;
			}
			if (event.name == "phase") {
				return event.skill;
			}
			if (event.name == "damage") {
				return !event.card;
			}
			return true;
		},
		async content(event, trigger, player) {
			if (trigger.name == "phase" || trigger.name == "damage") {
				return;
				trigger.cancel();
			} else {
				if (trigger.player.maxHp > 20) {
					const target = trigger.player;
					await target.getSkills(true, false, false).forEach(skill => {
						if (!get.info(skill).qiuli) target.removeSkill(skill, true);
					})
					trigger.player.die();
				}
			}
			//throw new Error();
		},
	},
	//凌统
	ql_fenlu: {
		enable: ["chooseToUse", "chooseToRespond"],
		filterCard(card, player) {
			return get.type2(card) != "basic";
		},
		position: "hes",
		viewAs: {
			name: "sha",
			storage: {
				ql_fenlu: true,
			},
		},
		popname: true,
		selectCard: 1,
		viewAsFilter(player) {
			if (!player.hasCard(card => get.type2(card) != "basic", "hes")) {
				return false;
			}
			return true;
		},
		check(card) {
			const val = get.value(card);
			return 5 - val;
		},
		async precontent(event, trigger, player) {
			event.getParent().oncard = function () {
				get.event().baseDamage++;
				//game.log(get.event().baseDamage);
			}
		},
		mod: {
			targetInRange(card, player) {
				if (card?.storage?.ql_fenlu) {
					return true;
				}
			},
		},
	},
	ql_jiechou: {
		group: "ql_jiechou_begin",
		trigger: {
			player: "phaseUseBegin",
		},
		locked: true,
		filter(event, player) {
			if (game.dead.length == 0) {
				return false;
			}
			return game.hasAllGlobalHistory("everything", evt => evt.name == "die" && evt.source);
		},
		async cost(event, trigger, player) {
			event.result = await player.chooseTarget()
				.set("prompt", "选择一名杀死过其他角色的角色")
				.set("filterTarget", (card, player, target) => {
					return game.hasAllGlobalHistory("everything", evt => evt.name == "die" && evt.source == target) && player != target;
				})
				.set("selectTarget", 1)
				.forResult();
		},
		async content(event, trigger, player) {
			event.targets[0].addTempSkill(event.name + "_num");
		},
		mod: {
			cardUsableTarget(card, player, target) {
				if (target.hasSkill("ql_jiechou_num") || player == target) {
					return Infinity;
				}
			}
		},
		subSkill: {
			begin: {
				trigger: {
					player: "enterGame",
					global: "phaseBefore",
				},
				forced: true,
				locked: true,
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				async content(event, trigger, player) {
					player.addSkills("decadexuanfeng");
				},
			},
		},
	},
	ql_yinqi: {
		trigger: {
			global: "phaseEnd",
		},
		filter(event, player) {
			if (!game.hasPlayer(current => {
				return current.countDiscardableCards(player, "ej");
			})) {
				return false;
			}
			return game.hasGlobalHistory("useCard", evt => {
				return evt.targets?.includes(player) && get.type2(evt.card) == "trick";
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.countDiscardableCards(player, "ej");
				})
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "guohe_copy", position: "ej" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (target.countDiscardableCards(player, "ej")) {
				await player.discardPlayerCard(target, "ej", true);
			}
		},
	},
	//夏侯尚
	qlposhan: {
		audio: "mbtanfeng",
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			return lib.inpile.includes(name) && get.type(name) == "basic" && player.getStorage("qlposhan_used").length < 2;
		},
		filter(event, player) {
			return player.getStorage("qlposhan_used").length < 2 && get.info("qlposhan").getList(event, player).length > 0;
		},
		getList(event, player) {
			return get.inpileVCardList(info => {
				return info[0] == "basic" && event.filterCard(get.autoViewAs({ name: info[2], nature: info[3], isCard: true, storage: { qlposhan: true } }), player, event);
			})
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.info("qlposhan").getList(event, player);
				const num = Math.max(player.getDamagedHp(), 1);
				return ui.create.dialog("破栅", [
					[
						["draw", `摸${num}张牌`],
						["discard", `弃${num}张牌`],
					],
					"tdnodes"
				], [list, "vcard"], "hidden");
			},
			check(button) {
				if (typeof button.link == "string") {
					return button.link == "draw" ? 2 : 1;
				}
				return get.player().getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3], isCard: true, storage: { qlposhan: true } }));
			},
			select: 2,
			filter(button) {
				const player = get.player();
				if (!ui.selected.buttons?.length) {
					if (button.link == "discard" && player.getDiscardableCards(player, "he") < player.getDamagedHp()) {
						return false;
					}
					return !player.getStorage("qlposhan_used").includes(button.link) && typeof button.link == "string";
				}
				return typeof button.link != "string";
			},
			backup(links, player) {
				return {
					log: false,
					filterCard(card) {
						const player = get.player();
						const choice = get.info("qlposhan_backup").links[0];
						if (choice == "discard") {
							return lib.filter.cardDiscardable(card, player);
						}
						return false;
					},
					selectCard() {
						const player = get.player();
						const choice = get.info("qlposhan_backup").links[0];
						if (choice == "discard") {
							return Math.max(player.getDamagedHp(), 1);
						}
						return -1;
					},
					position: "hes",
					ignoreMod: true,
					links: links,
					viewAs: {
						name: links[1][2],
						nature: links[1][3],
						isCard: true,
						cards: [],
						/*suit: "none",
						color: "none",
						number: null,*/
						storage: {
							qlposhan: true,
						}
					},
					async precontent(event, trigger, player) {
						const name = "qlposhan";
						player.logSkill(name);
						const { links: [choice, list] } = get.info(event.name.slice(4));
						player.addTempSkill(name + "_used");
						player.markAuto(name + "_used", choice);
						if (choice == "discard") {
							const { cards } = event.result;
							event.result.cards = [];
							event.result.card = get.autoViewAs({ name: list[2], nature: list[3], isCard: true, storage: { qlposhan: true } });
							await player.discard(cards);
						}
						else {
							await player.draw(Math.max(player.getDamagedHp(), 1));
						}
						event.getParent().addCount = false;
					}
				}
			},
			prompt(links, player) {
				const num = Math.max(player.getDamagedHp(), 1);
				let str = links[0] == "draw" ? `摸${num}张牌并视为使用` : `弃${num}张牌并视为使用`;
				return str + `${get.translation(links[1][3]) || ""}【${get.translation(links[1][2])}】`;
			}
		},
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.qlposhan) {
					return Infinity;
				}
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			}
		},
		ai: {
			order: 7,
			skillTagFilter(player, tag, arg) {
				const storage = player.getStorage("qlposhan_used");
				if (storage.length >= 2 || (storage.length == 1 && storage[0] == "draw" && player.countDiscardableCards(player, "he") < player.getDamagedHp())) {
					return false;
				}
			},
			result: {
				player(player) {
					if (_status.event.dying) return get.attitude(player, _status.event.dying);
					return 1;
				},
			},
			respondSha: true,
			respondShan: true,
			tag: {
				recover: 1,
				save: 1,
			},
		},
	},
	qltanyong: {
		audio: "mbtanfeng",
		forced: true,
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		filter(event, player) {
			const num = player.countCards("h");
			if (event.name == "useCardToPlayered") {
				return num == event.target.countCards("h") && event.target != player;
			}
			else {
				return num == event.player.countCards("h") && event.player != player;
			}
		},
		async content(event, trigger, player) {
			await player.draw();
		},
		group: "qltanyong_discard",
		subSkill: {
			discard: {
				audio: "qltanyong",
				forced: true,
				trigger: {
					player: "loseAfter",
					global: "loseAsyncAfter",
				},
				filter(event, player) {
					return event.type == "discard" && event.getl?.(player)?.cards2?.length > 0;
				},
				async content(event, trigger, player) {
					const types = trigger.getl?.(player)?.cards2?.map(card => get.type2(card)).unique();
					if (types.includes("basic")) {
						await player.draw();
					}
					if (types.includes("trick")) {
						const cards = trigger.getl?.(player)?.cards2.filter(card => get.position(card) == "d");
						if (cards?.length) {
							const result = await player
								.chooseToMove(true)
								.set("list", [["牌堆顶", cards], ["弃牌堆"]])
								.set("prompt", "探勇：将其中任意数量牌置于牌堆顶（靠左的接近牌堆顶）")
								.set("processAI", function (list) {
									let cards = list[0][1],
										player = _status.event.player,
										target = _status.currentPhase || player,
										name = _status.event.getTrigger()?.name,
										countWuxie = current => {
											let num = current.getKnownCards(player, card => {
												return get.name(card, current) === "wuxie";
											});
											if (num && current !== player) {
												return num;
											}
											let skills = current.getSkills("invisible").concat(lib.skill.global);
											game.expandSkills(skills);
											for (let i = 0; i < skills.length; i++) {
												let ifo = get.info(skills[i]);
												if (!ifo) {
													continue;
												}
												if (ifo.viewAs && typeof ifo.viewAs != "function" && ifo.viewAs.name == "wuxie") {
													if (!ifo.viewAsFilter || ifo.viewAsFilter(current)) {
														num++;
														break;
													}
												} else {
													let hiddenCard = ifo.hiddenCard;
													if (typeof hiddenCard == "function" && hiddenCard(current, "wuxie")) {
														num++;
														break;
													}
												}
											}
											return num;
										},
										top = [];
									switch (name) {
										case "phaseJieshu":
											target = target.next;
										// [falls through]
										case "phaseZhunbei": {
											let att = get.sgn(get.attitude(player, target)),
												judges = target.getCards("j"),
												needs = 0,
												wuxie = countWuxie(target);
											for (let i = Math.min(cards.length, judges.length) - 1; i >= 0; i--) {
												let j = judges[i],
													cardj = j.viewAs ? { name: j.viewAs, cards: j.cards || [j] } : j;
												if (wuxie > 0 && get.effect(target, j, target, target) < 0) {
													wuxie--;
													continue;
												}
												let judge = get.judge(j);
												cards.sort((a, b) => {
													return (judge(b) - judge(a)) * att;
												});
												if (judge(cards[0]) * att < 0) {
													needs++;
													continue;
												} else {
													top.unshift(cards.shift());
												}
											}
											if (needs > 0 && needs >= judges.length) {
												return [top, cards];
											}
											cards.sort((a, b) => {
												return (get.value(b, target) - get.value(a, target)) * att;
											});
											while (needs--) {
												top.unshift(cards.shift());
											}
											while (cards.length) {
												if (get.value(cards[0], target) > 6 == att > 0) {
													top.push(cards.shift());
												} else {
													break;
												}
											}
											return [top, cards];
										}
										default:
											cards.sort((a, b) => {
												return get.value(b, target) - get.value(a, target);
											});
											while (cards.length) {
												if (get.value(cards[0], target) > 6) {
													top.push(cards.shift());
												} else {
													break;
												}
											}
											return [top, cards];
									}
								})
								.forResult();
							if (result?.moved?.length) {
								const top = result.moved[0];
								if (top.length) {
									game.log(player, "将", top, "置于牌堆顶");
									await game.cardsGotoPile(top.reverse(), "insert");
								}
							}
						}
					}
					if (types.includes("equip")) {
						const next = player
							.chooseTarget("探勇：令一名体力值不大于你的角色回复一点体力或令一名体力值大于你的角色失去一点体力", true)
							.set("ai", target => {
								const player = get.player();
								if (target.hp <= player.hp) {
									return get.recoverEffect(target, player, player);
								}
								return get.effect(target, { name: "losehp" }, player, player);
							})
						next.targetprompt2.push(target => {
							if (!target.classList.contains("selectable")) {
								return false;
							}
							if (target.hp <= get.player().hp) {
								return "回复体力";
							}
							return "失去体力";
						});
						const result = await next.forResult();
						if (result?.targets?.length) {
							const { targets: [target] } = result;
							player.line(target);
							if (target.hp <= player.hp) {
								await target.recover();
							}
							else {
								await target.loseHp();
							}
						}
					}
				}
			},
		}
	},
	//孙坚
	qlfendeng: {
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		async cost(event, trigger, player) {
			const evts = player.getAllHistory("custom", evt => evt.skill == event.skill);
			if (evts.length > 1 && evts.slice(-2).every(evt => evt.type == "draw")) {
				event.result = {
					bool: true,
					cost_data: "losehp",
				};
				return;
			}
			const result = await player
				.chooseButton([
					"奋登：选择一项",
					[
						[
							["losehp", "失去1点体力，摸一张牌且本回合出杀次数+1（若体力值为1改为增加一点体力上限）"],
							["draw", "摸五张牌，结束本回合"],
						],
						"textbutton",
					]
				], true)
				.set("ai", () => Math.random())
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		locked: true,
		async content(event, trigger, player) {
			const { cost_data: type, name } = event;
			player.getHistory("custom").push({ skill: name, type: type });
			if (type == "draw") {
				await player.draw(5);
				const evt = event.getParent("phase", true);
				if (evt?.player == player) {
					game.log(player, "结束了回合");
					evt.num = evt.phaseList.length;
					evt.goto(11);
				}
				trigger.cancel();
			} else {
				await player.hp != 1 ? player.loseHp() : player.gainMaxHp();
				await player.draw();
				player
					.when({
						global: ["phaseAfter", "phaseBeginStart"],
					})
					.step(async () => { })
					.assign({
						mod: {
							cardUsable(card, player, num) {
								if (card.name == "sha") {
									return num + 1;
								}
							},
						},
					});
			}
		},
	},
	qlyinghun: {
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			return player.getDamagedHp() > 0;
		},
		async cost(event, trigger, player) {
			const list = [
				["changehp", "将体力值调整至1点并获得等量“血”标记，下个结束阶段移去所有“血”标记并回复等量体力并摸一张牌"],
				["extra", "直到你的下个结束阶段，单次获得超过一张牌后摸一张牌"],
				["draw", "直到你的下个结束阶段，每扣减1点体力，摸两张牌"],
			];
			if (player.hasSkill("qlxiongyong")) {
				list.addArray([
					["draw1", "摸一张牌，然后弃置三张牌"],
					["draw3", "摸三张牌，然后弃置一张牌"],
				]);
			}
			const num = Math.min(player.getDamagedHp(), list.length);
			const result = await player
				.chooseButtonTarget({
					createDialog: [get.prompt(event.skill), [list, "textbutton"]],
					selectButton: num,
					selectTarget: [0, 2],
					filterTarget: lib.filter.notMe,
					ai1(button) {
						return ["draw1", "draw3", "changehp", "extra", "draw"].indexOf(button.link) + 1;
					},
					ai2(target) {
						return get.attitude(get.player(), target);
					},
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				const targets = [player];
				if (result.targets?.length) {
					targets.addArray(result.targets);
					targets.sortBySeat();
				}
				event.result = {
					bool: true,
					targets: targets,
					cost_data: result.links,
				};
			}
		},
		async content(event, trigger, player) {
			const { targets, cost_data: links, name } = event;
			if (links.includes("extra")) {
				const func = async target => {
					const current = target,
						skill = `${name}_extra`;
					player
						.when("phaseJieshuBefore")
						.step(async (event, trigger, player) => {
							current.unmarkAuto(skill, player);
							if (!current.getStorage(skill).length) {
								current.removeSkill(skill);
							}
						});
					current.addSkill(skill);
					current.markAuto(skill, player);
				};
				await game.doAsyncInOrder(targets, func);
			}
			if (links.includes("draw")) {
				const func = async target => {
					const current = target,
						skill = `${name}_draw`;
					player
						.when("phaseJieshuBefore")
						.step(async (event, trigger, player) => {
							current.unmarkAuto(skill, player);
							if (!current.getStorage(skill).length) {
								current.removeSkill(skill);
							}
						});
					current.addSkill(skill);
					current.markAuto(skill, player);
				};
				await game.doAsyncInOrder(targets, func);
			}
			if (links.includes("changehp")) {
				const func = async target => {
					const skill = `${name}_xue`,
						num = target.getHp() - 1;
					if (num > 0) {
						target.addSkill(skill);
						await target.changeHp(-num);
						target.addMark(skill, num);
					}
				};
				await game.doAsyncInOrder(targets, func);
			}
			if (links.includes("draw1")) {
				const func = async target => {
					await target.draw(1);
					const num = Math.min(3, target.countDiscardableCards(target, "he"));
					if (num > 0) {
						await target.chooseToDiscard(num, "he", true);
					}
				};
				await game.doAsyncInOrder(targets, func);
			}
			if (links.includes("draw3")) {
				const func = async target => {
					await target.draw(3);
					const num = Math.min(1, target.countDiscardableCards(target, "he"));
					if (num > 0) {
						await target.chooseToDiscard(num, "he", true);
					}
				};
				await game.doAsyncInOrder(targets, func);
			}
		},
		subSkill: {
			extra: {
				charlotte: true,
				onremove: true,
				intro: {
					nocount: true,
					content: "你单次获得超过一张牌后，摸一张牌",
				},
				trigger: {
					player: "gainAfter",
					global: "loseAsyncAfter",
				},
				filter(event, player) {
					return event.getg(player)?.length > 1;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.draw();
				},
			},
			draw: {
				charlotte: true,
				onremove: true,
				intro: {
					nocount: true,
					content: "你扣减1点体力后，摸两张牌",
				},
				trigger: {
					player: "changeHpAfter",
				},
				getIndex(event) {
					return Math.abs(event.num);
				},
				filter(event, player) {
					return event.num < 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.draw(2);
				},
			},
			xue: {
				charlotte: true,
				onremove: true,
				marktext: "血",
				intro: {
					name: "血",
					name2: "血",
					content: "结束阶段，你移去所有“血”标记并回复等量体力，然后摸一张牌",
				},
				trigger: {
					player: "phaseJieshuBegin",
				},
				filter(event, player) {
					return player.countMark("qlyinghun_xue");
				},
				firstDo: true,
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const name = event.name,
						num = player.countMark(name);
					if (num > 0) {
						player.removeMark(name, num);
						await player.recover(num);
					}
					await player.draw();
				},
			},
		},
	},
	qlxiongyong: {
		zhuSkill: true,
		ai: {
			combo: "qlyinghun",
		},
	},
	//秦公镈
	qlqinsheng: {
		audio: "ext:五花米线/audio/skill:2",
		chargeSkill: 5,
		group: ["qlqinsheng_init", "qlqinsheng_effect", "qlqinsheng_regain"],
		global: ["qlqinsheng_damage"],
		enable: "phaseUse",
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		filter(event, player) {
			if (get.translation(player).indexOf("秦公") < 0) {
				return false;
			}
			return player.countCharge() && game.hasPlayer(target => target.hasMark("qlqinsheng"));
		},
		filterTarget(card, player, target) {
			const targets = ui.selected.targets;
			if (!targets?.length) {
				return target.hasMark("qlqinsheng");
			}
			return true;
		},
		selectTarget: 2,
		complexTarget: true,
		multitarget: true,
		async content(event, trigger, player) {
			const { targets: [target1, target2] } = event;
			player.removeCharge(1);
			target1.removeMark(event.name, 1);
			target2.addMark(event.name);
			if (game.openZhizhi()) {
				const hs = player.getCards("hes");
				if (hs.length) {
					const list = get.inpileVCardList(info => {
						if (info[0] == "equip") {
							return false;
						}
						const viewas = (card) => get.autoViewAs({ name: info[2], nature: info[3] }, [card]);
						return hs.some(card => player.hasUseTarget(viewas(card)) || (get.info(viewas(card)).notarget && lib.filter.cardEnabled(viewas(card), player)));
					});
					if (list.length) {
						const result = await player
							.chooseButton([
								`沁声·致知：你可以将一张牌当作非装备牌使用`,
								[list, "vcard"],
							])
							.set("ai", button => {
								return get.player().getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3] }, "unsure"));
							})
							.forResult();
						if (result?.bool && result?.links?.length) {
							const { links: [info] } = result;
							game.broadcastAll(info => {
								lib.skill["qlqinsheng_backup"].viewAs = { name: info[2], nature: info[3] };
							}, info);
							await player
								.chooseToUse()
								.set("openskilldialog", `沁声·致知：是否将一张牌${get.translation(info[3]) || ""}【${get.translation(info[2])}】当作使用？`)
								.set("norestore", true)
								.set("_backupevent", `${event.name}_backup`)
								.set("custom", {
									add: {},
									replace: { window() { } },
								})
								.backup(`${event.name}_backup`)
								.set("targetRequired", true)
								.set("complexTarget", true)
								.set("complexSelect", true)
								.set("addCount", false);
						}
					}
				}
			}
			await player.draw();
			player.addSkill(`${event.name}_nocount`);
		},
		intro: {
			content: "mark",
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					const targets = ui.selected.targets;
					if (!targets?.length) {
						if (target.countMark("qlqinsheng") > 1) {
							return get.sgnAttitude(player, target);
						}
						return -1;
					}
					else {
						if (!target.hasMark("qlqinsheng")) {
							return 1;
						}
					}
				}
			}
		},
		subSkill: {
			backup: {
				log: false,
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				position: "hes",
				check(card) {
					return 7.5 - get.value(card);
				},
			},
			regain: {
				audio: "qlqinsheng",
				forced: true,
				locked: false,
				trigger: {
					global: "dieBegin",
				},
				filter(event, player) {
					return event.player.hasMark("qlqinsheng");
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const { targets: [target] } = event;
					if (target != player) {
						const num = target.countMark("qlqinsheng");
						target.clearMark("qlqinsheng");
						player.addMark("qlqinsheng", num);
					} else {
						await player.removeMark("qlqinsheng");
						await player.recoverTo(player.maxHp);
						if (player.hp > 0) {
							trigger.cancel();
							player.insertPhase();
						}
					}
				}
			},
			effect: {
				audio: "qlqinsheng",
				forced: true,
				locked: false,
				trigger: {
					source: "damageSource",
					player: "damageEnd",
				},
				getIndex: event => event.num,
				filter(event, player, name) {
					if (name == "damageEnd") {
						return game.hasPlayer(target => target.hasMark("qlqinsheng"));
					}
					return player.countCharge(true) > 0;
				},
				async content(event, trigger, player) {
					if (event.triggername == "damageSource") {
						player.addCharge();
					}
					else {
						const targets = game.filterPlayer(target => target.hasMark("qlqinsheng"));
						let target;
						if (targets.length == 1) {
							target = targets[0];
						}
						else {
							const result = await player
								.chooseTarget(`沁声：令一名有“沁声”标记的角色选择一项：1.使用一张牌，若造成伤害，摸两倍伤害值张牌；2.摸伤害值张牌`, true, (card, player, target) => {
									return get.event().targets.includes(target)
								})
								.set("targets", targets)
								.set("ai", target => get.attitude(get.player(), target) * (114514 - target.countCards("h")))
								.forResult();
							if (result?.targets?.length) {
								target = result.targets[0];
							}
						}
						if (target) {
							player.line(target);
							const choice = [
								`用一张牌，若造成伤害，摸两倍伤害值张牌`,
								`摸伤害值张牌`,
							];
							let result;
							if (!target.hasCard(card => target.hasUseTarget(card) || lib.filter.cardEnabled(card, player), "hs")) {
								result = { index: 1 };
							}
							else {
								result = await target
									.chooseControl()
									.set("choiceList", choice)
									.set("choice", 0)
									.set("prompt", "沁声：请选择一项")
									.forResult();
							}
							if (typeof result?.index == "number") {
								const { index } = result;
								if (index == 0) {
									await target
										.chooseToUse(`沁声：请使用一张牌，若造成伤害，摸两张牌`, true)
										.set("oncard", () => {
											const { card, player } = get.event();
											player
												.when("useCardAfter")
												.filter(evt => evt.card == card)
												.step(async (event, trigger, player) => {
													const num = player.getHistory("sourceDamage", evt => evt.card == trigger.card).reduce((sum, evt) => sum + evt.num, 0);
													if (num > 0) {
														await player.draw(2 * num);
													}
												})
										})
								}
								else {
									await target.draw(trigger.num);
								}
							}
						}
					}
				}
			},
			nocount: {
				mod: {
					cardUsable: () => Infinity,
				},
				trigger: {
					player: "useCard1",
				},
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				content() {
					player.removeSkill(event.name);
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] == "number") {
							stat[name]--;
						}
					}
				},
				mark: true,
				intro: {
					content: "使用下一张牌无次数限制",
				},
			},
			damage: {
				audio: "qlqinsheng",
				charlotte: true,
				forced: true,
				trigger: {
					source: "damageBegin1",
				},
				filter(event, player) {
					return player.hasMark("qlqinsheng") && game.hasPlayer(target => target.hasSkill("qlqinsheng"));
				},
				async content(event, trigger, player) {
					trigger.num *= 2;
				}
			},
			init: {
				audio: "qlqinsheng",
				trigger: {
					player: "enterGame",
					global: "phaseBefore",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					player.addCharge(2);
					player.addMark("qlqinsheng", 2);
				},
			},
		},
	},
	qllingyong: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: "phaseZhunbeiBegin",
		},
		superCharlotte: true,
		persevereSkill: true,
		fixed: true,
		filter(event, player) {
			if (get.translation(player).indexOf("秦公") < 0) {
				return false;
			}
			return get.distance(player, event.player) <= 1;
		},
		logTarget: "player",
		check: () => true,
		async content(event, trigger, player) {
			await player.turnOver();
		},
		group: ["qllingyong_effect1", "qllingyong_effect2", "qllingyong_effect3", "qllingyong_effect4"],
		subSkill: {
			effect1: {
				audio: "qllingyong",
				priority: 100,
				trigger: {
					player: "turnOverAfter",
				},
				filter(event, player) {
					if (!player.isTurnedOver()) {
						return game.hasPlayer(target => target.isTurnedOver() || get.distance(target, player) == 1);
					}
					return game.hasPlayer(target => get.distance(target, player) <= 3);
				},
				async cost(event, trigger, player) {
					if (!player.isTurnedOver()) {
						event.result = await player
							.chooseTarget(get.prompt(event.skill), "对任意名背面向上或距离你为1或体力上限不小于你的角色造成一点伤害", [1, Infinity], (card, player, target) => {
								return target.isTurnedOver() || get.distance(target, player) == 1 || target.maxHp >= player.maxHp;
							})
							.set("ai", target => get.damageEffect(target, get.player(), get.player()))
							.forResult();
					}
					else {
						event.result = {
							bool: true,
						}
					}
				},
				async content(event, trigger, player) {
					if (!player.isTurnedOver()) {
						const { targets } = event;
						await game.doAsyncInOrder(targets, async target => {
							target.addAdditionalSkill("qllingyong" + player.playerid, ["qllingyong_dist", "qllingyong_debuff"]);
							target.markAuto("qllingyong_dist", player);
							player.addTempSkill("qllingyong_clear", { player: "phaseAfter" });
							return target.damage();
						});
					}
					else {
						const num = game.countPlayer(target => get.distance(target, player) <= 3);
						await player.draw(num);
						const result = await player
							.chooseTarget("灵雍：你可以令一名其他角色翻面", lib.filter.notMe)
							.set("ai", target => {
								if (target.hasSkillTag("noturn")) {
									return 0;
								}
								return (target.isTurnedOver() ? 1 : -1) * get.attitude(get.player(), target);
							})
							.forResult();
						if (result?.bool && result.targets?.length) {
							const { targets: [target] } = result;
							player.line(target);
							await target.turnOver();
						}
					}
				}
			},
			effect2: {
				audio: "qllingyong",
				priority: 99,
				trigger: {
					player: "turnOverAfter",
				},
				filter(event, player) {
					return player.canMoveCard();
				},
				async cost(event, trigger, player) {
					const result = await player.chooseBool(`###${get.prompt(event.skill)}###移动场上一张牌`).set("choice", player.canMoveCard(true)).forResult();
					if (result?.bool == true || (game.openZhizhi() && result?.bool == false && player.isDamaged())) {
						event.result = {
							bool: true,
							cost_data: result.bool,
						}
					}
				},
				async content(event, trigger, player) {
					const { cost_data: bool } = event;
					if (bool) {
						await player.moveCard();
					}
					else {
						await player.recover();
					}
				}
			},
			effect3: {
				audio: "qllingyong",
				forced: true,
				locked: false,
				trigger: {
					player: ["phaseDiscardBefore", "damageBegin4"],
				},
				filter(event, player) {
					return player.isTurnedOver();
				},
				async content(event, trigger, player) {
					if (trigger.name == "damage") {
						trigger.num = Math.floor(trigger.num / 2);
					}
					else {
						trigger.cancel();
					}
				}
			},
			effect4: {
				audio: "qllingyong",
				forced: true,
				locked: false,
				trigger: {
					player: ["loseHpBegin"],
				},
				filter(event, player) {
					return true;
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			dist: {
				onremove: true,
				intro: {
					content: "你与$互相计算距离为1",
				},
				mod: {
					globalFrom(from, to, distance) {
						if (from.getStorage("qllingyong").includes(to)) {
							return -Infinity;
						}
					},
					globalTo(from, to, distance) {
						if (to.getStorage("qllingyong").includes(from)) {
							return -Infinity;
						}
					},
				},
			},
			debuff: {
				charlotte: true,
				mod: {
					cardEnabled(card, player) {
						if (get.type(card) == "basic") {
							return false;
						}
					},
					cardRespondable(card, player) {
						if (get.type(card) == "basic") {
							return false;
						}
					},
					cardSavable(card, player) {
						if (get.type(card) == "basic") {
							return false;
						}
					},
				},
				mark: true,
				marktext: "基",
				intro: {
					content: "不能使用或打出基本牌",
				}
			},
			clear: {
				onremove(player, skill) {
					game.filterPlayer2().forEach(target => {
						target.removeAdditionalSkill("qllingyong" + player.playerid);
						target.unmarkAuto("qllingyong_dist", player);
					});
				},
				charlotte: true,
			}
		},
	},
	//羲和
	startGame_tr_xihe: {
		trigger: {
			global: "gameStart",
		},
		/*filter(event, player) {
			return player.name == "tr_xihe";
		},*/
		charlotte: true,
		firstDo: true,
		async cost(event, trigger, player) {
			game.broadcastAll((bg, bm) => {
				_status.tempBackground = bg;
				game.updateBackground();
				_status.tempMusic = bm;
			}, `ext:五花米线/skin/background/xihe_bg.jpg`, `ext:五花米线/audio/background/Take Flight.mp3`);

			game.broadcastAll(player => {
				// ***修改1：游戏开始时设置为静态图片tr_xihe.jpg***
				player.node.avatar.setBackgroundImage("extension/五花米线/skin/tr_xihe.jpg");

				game.pause();
				const dialog = document.createElement("video");
				dialog.style.backgroundColor = "black";
				dialog.style.position = "absolute";
				dialog.style.top = "0";
				dialog.style.left = "0";
				dialog.style.width = "100%";
				dialog.style.height = "100%";
				dialog.style.zIndex = "1001";
				dialog.muted = true;
				dialog.setAttribute("src", `${lib.assetURL}extension/五花米线/video/xihe.mp4`);
				dialog.setAttribute("autoplay", "autoplay");
				ui.background.appendChild(dialog);

				const musicTimer = setTimeout(() => {
					if (_status.tempMusic) {
						game.playBackgroundMusic();
					}
				}, 3000);

				// ***修改点：在33秒后（最后1秒）开始抖动ui.window并切换为GIF***
				const videoShakeTimer = setTimeout(() => {
					// ***修改2：在抖动开始前切换玩家头像到动态GIF***
					player.node.avatar.setBackgroundImage("extension/五花米线/skin/tr_xihe.GIF");

					// ***ui.window抖动效果开始***
					const windowShake = () => {
						// 使用ui.window作为抖动主体
						const windowContainer = ui.window || ui.game || document.body;

						if (!windowContainer) return;

						const originalTransform = windowContainer.style.transform || '';
						const intensity = 8; // 抖动力度 - 适中的窗口抖动
						const duration = 1000; // 持续1秒
						const interval = 25; // 间隔时间
						const shakes = Math.floor(duration / interval);
						let currentShake = 0;

						// ***新增：存储所有玩家头像的原始变换状态***
						const playerOriginalTransforms = new Map();

						const shakeInterval = setInterval(() => {
							if (currentShake >= shakes) {
								clearInterval(shakeInterval);
								windowContainer.style.transform = originalTransform; // 恢复原状

								// ***恢复所有玩家头像的原始变换状态***
								game.countPlayer(current => {
									const originalTransform = playerOriginalTransforms.get(current);
									if (originalTransform !== undefined) {
										current.node.avatar.style.transform = originalTransform;
									}
								});

								return;
							}

							// 计算当前抖动的强度（随时间衰减）
							const decay = 1 - (currentShake / shakes); // 从1衰减到0
							const currentIntensity = intensity * decay;

							// 随机偏移
							const offsetX = (Math.random() - 0.5) * 2 * currentIntensity;
							const offsetY = (Math.random() - 0.5) * 2 * currentIntensity;
							const rotate = (Math.random() - 0.5) * 0.5 * decay; // 轻微旋转

							// 应用抖动到ui.window（只有平移和轻微旋转，没有缩放）
							windowContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotate}deg)`;

							// ***新增：让所有游戏角色也跟着抖动***
							game.countPlayer(current => {
								// 如果是第一次抖动这个角色，保存其原始变换状态
								if (!playerOriginalTransforms.has(current)) {
									playerOriginalTransforms.set(current, current.node.avatar.style.transform || '');
								}

								// 为角色计算单独的抖动参数（幅度稍大一些）
								const playerOffsetX = (Math.random() - 0.5) * 2 * currentIntensity * 1.2;
								const playerOffsetY = (Math.random() - 0.5) * 2 * currentIntensity * 1.2;
								const playerRotate = (Math.random() - 0.5) * 0.8 * decay;

								// 应用抖动到角色头像
								current.node.avatar.style.transform = `translate(${playerOffsetX}px, ${playerOffsetY}px) rotate(${playerRotate}deg)`;
							});

							currentShake++;
						}, interval);
					};

					// 执行ui.window抖动效果
					windowShake();
					// ***ui.window抖动效果结束***
				}, 33000); // 33秒后开始抖动（视频总长34秒，最后1秒抖动）

				setTimeout(() => {
					ui.background.removeChild(dialog);
					game.resume();
					clearTimeout(musicTimer);
					clearTimeout(videoShakeTimer); // 清理抖动计时器
				}, 34000);

				const sun = ui.create.player(null, true);
				sun.setBackgroundImage("extension/五花米线/skin/xihe_sun.jpg");
				sun.classList.add("minskin");
				sun.node.marks.remove();
				sun.node.hp.remove();
				sun.node.count.remove();
				sun.style.left = "calc(50% - 60px)";
				sun.style.top = "calc(50% - 60px)";
				sun.style.borderRadius = "100%";
				sun.node.avatar.style.borderRadius = "100%";
				sun.node.name.remove();
				sun.pos1 = player.hp;
				sun.pos2 = player.maxHp;
				sun.setPos = function () {
					let lx = ui.background.offsetWidth / 2 - 120,
						ly = Math.min(lx, ui.background.offsetHeight / 2 - 60);
					const { pos1, pos2 } = this;
					let deg = (Math.PI * pos1) / pos2;
					let dx = Math.round(lx * Math.cos(deg));
					let dy = Math.round(-ly * Math.sin(deg));
					this.style.transform = "translate(" + dx + "px," + dy + "px) scale(0.8, 0.8)";
				};
				player.node.hp.remove();
				sun.setPos();
				ui.background.appendChild(sun);
				_status.xiheIntheSun = setInterval(function () {
					if (player?.isIn()) {
						const bool = sun.pos1 != player.hp || sun.pos2 != player.maxHp;
						sun.pos1 = player.hp;
						sun.pos2 = player.maxHp;
						if (bool) {
							sun.setPos();
						}
					} else {
						clearInterval(_status.xiheIntheSun);
						ui.background.removeChild(sun);
					}
				}, 100);
			}, player);

			player.addSkill("startGame_tr_xihe_limit");
		},
		subSkill: {
			limit: {
				trigger: {
					player: ["changeHpBegin", "damageBegin4"],
					global: "roundStart",
				},
				init(player, skill) {
					const filters = [player => player.hp * 3 <= player.maxHp * 2, player => player.hp * 3 <= player.maxHp, player => player.hp == 1];
					for (let i = 0; i < 3; i++) {
						const check = filters[i];
						const others = filters.slice(i + 1);
						player
							.when("changeHpAfter")
							.filter((evt, pla) => {
								return evt.num < 0 && check(pla);
							})
							.step(async (event, trigger, player) => {
								if (others.length && others.some(filter => filter(player))) {
									return;
								}

								game.broadcastAll(() => {
									const dialog = document.createElement("video");
									dialog.style.backgroundColor = "black";
									dialog.style.position = "absolute";
									dialog.style.top = "0";
									dialog.style.left = "0";
									dialog.style.width = "100%";
									dialog.style.height = "100%";
									dialog.style.zIndex = "1001";
									dialog.muted = true;
									dialog.setAttribute("src", `${lib.assetURL}extension/五花米线/video/xihe_${i + 1}.mp4`);
									dialog.setAttribute("autoplay", "autoplay");
									dialog.addEventListener("ended", function () {
										ui.background.removeChild(dialog);
									});
									ui.background.appendChild(dialog);
								});
								const prompt = ["你击落了太阳！！！", "来自远古神明的怒火", "暾将出兮东方<br>照吾槛兮扶桑"][others.length];
								/*const prompt = [
									"暾将出兮东方<br>照吾槛兮扶桑",
									"暾将出兮东方<br>照吾槛兮扶桑",
								].randomGet();*/
								player.$fullscreenpop(`<span style="font-family:xingkai;color:#dbd111">${prompt}</span>`);

								for (const phase of lib.phaseName) {
									const evt = get.event().getParent(phase);
									if (evt?.name === phase) {
										const name = get.translation(phase);
										game.log(player, "令", evt.player, "结束了" + name);
										evt.skipped = true;
									}
								}
								const evt = get.event().getParent("phase", true);
								if (evt) {
									game.log(evt.player, "结束了回合");
									evt.num = evt.phaseList.length;
									evt.goto(11);
								}
								const next = player.insertPhase();
								delete next.skill;
							});
					}
				},
				filter(event, player) {
					if (event.name != "changeHp") {
						return true;
					}
					if (event.num < -24) {
						return true;
					}
					return player.hp > 1 && player.hp + event.num <= 1;
				},
				firstDo: true,
				charlotte: true,
				marktext: "羲",
				intro: {
					name: "羲和",
					nocount: true,
					content(storage, player) {
						const list = player.getStorage("startGame_tr_xihe_limit");
						if (!list.length) {
							return "无效果";
						}
						return `你受到${get.translation(list[0])}牌造成的伤害时，翻3倍；<br>你受到${get.translation(list[1])}牌造成的伤害时。翻2倍`;
					},
				},
				async cost(event, trigger, player) {
					if (trigger.name != "changeHp") {
						if (trigger.name == "damage") {
							const list = player.getStorage(event.skill);
							if (!list.length) {
								return;
							}
							if (get.suit(trigger.card) == list[0]) {
								trigger.num *= 3;
							}
							if (get.type2(trigger.card) == list[1]) {
								trigger.num *= 2;
							}
						} else {
							const suit = lib.suit.randomGet(),
								type = ["trick", "basic", "equip"].randomGet(),
								name = event.skill;
							player.setStorage(name, [suit, type], true);
							player.addTip(name, `羲和 ${get.translation(type)}${get.translation(suit)}`);
							player
								.when({
									global: "roundStart",
								})
								.filter(evt => evt != trigger)
								.step(async (event, trigger, player) => {
									player.setStorage(name.null, true);
									player.removeTip(name);
								});
						}
						return;
					}
					if (trigger.num < -24) {
						const evt = trigger.getParent();
						if (evt.name == "damage" && evt.source?.isIn() && evt.source != player) {
							trigger.cancel();
							await evt.source.changeHp(trigger.num);
							if (evt.source.hp <= 0 && !event.nodying) {
								await game.delayx();
								event._dyinged = true;
								await evt.source.dying({});
							}
							return;
						} else {
							trigger.num = -24;
						}
					}
					let maxNum = 1 - player.hp;
					trigger.num = Math.max(maxNum, trigger.num);
				},
			},
		},
	},
	qlmuhui: {
		persevereSkill: true,
		forced: true,
		locked: false,
		nobracket: true,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		firstDo: true,
		async content(event, trigger, player) {
			game.broadcastAll(player => {
				player.hp = 1440;
				player.maxHp = 1440;
				player.isBoss = true;
				player.$update();
			}, player);
			for (const list of lib.card.list) {
				ui.create.card(ui.cardPile).init(list);
			}
			await game.washCard();
			const origin_checkResult = game.checkResult;
			game.checkResult = function () {
				const player = game.me._trueMe || game.me;
				const bool1 = game.players.every(i => !i.isBoss);
				const bool2 = game.players.every(i => i.isBoss);
				if (bool1) {
					game.over(!player.isBoss);
				}
				if (bool2) {
					game.over(player.isBoss);
				}
				//return origin_checkResult.apply(this, arguments);
			};
			game.broadcastAll(player => {
				if (typeof game.checkOnlineResult === "function") {
					const origin_checkOnlineResult = game.checkOnlineResult;
					game.checkOnlineResult = function (player) {
						const bool1 = game.players.every(i => !i.isBoss);
						const bool2 = game.players.every(i => i.isBoss);
						if (bool1) {
							return !player.isBoss;
						}
						if (bool2) {
							return player.isBoss;
						}
						//return origin_checkOnlineResult.apply(this, arguments);
					};
				}
			}, player);
		},
		priority: Infinity,
		mod: {
			cardEnabled() {
				return true;
			},
			cardRespondable() {
				return true;
			},
			cardSavable() {
				return true;
			},
			cardUsable() {
				return Infinity;
			},
			targetInRange() {
				return true;
			},
			maxHandcardBase() {
				return 200;
			}
		},
		global: ["qlmuhui_debuff"],
		group: ["qlmuhui_def", "qlmuhui_phase", "qlmuhui_cancel"],//
		subSkill: {
			cancel: {
				forced: true,
				trigger: {
					global: ["useSkill", "logSkillBegin"],
				},
				filter(event, player) {
					if (["global", "equip"].includes(event.type) || event.player == player) {
						return false;
					}
					let skill = get.sourceSkillFor(event);
					if (!skill || event.player.getAllHistory("useSkill", evt => get.sourceSkillFor(evt.skill) == skill).length < 3) {
						return false;
					}
					let info = get.info(skill);
					if (!info || info.charlotte || info.equipSkill) {
						return false;
					}
					const skills = game.expandSkills([skill], true);
					return skills.some(i => lib.skill[i]?.content?.toString()?.includes("trigger.cancel") || lib.skill[i]?.content?.toString()?.includes("trigger.num="));
				},
				async content(event, trigger, player) {
					let skill = get.sourceSkillFor(trigger);
					const skills = game.expandSkills([skill], true);
					skills.forEach(skill => {
						for (const i in lib.hook) {
							const id = parseInt(i.split("_")[0]);
							if (id == trigger.player.playerid) {
								lib.hook[i].remove(skill);
							}
						}
					})
					game.log(trigger.player, "的", `#g【${get.translation(skill)}】`, "彻底无法触发了");
				},
			},
			debuff: {
				silent: true,
				trigger: {
					player: "gainEnd",
					global: ["loseAsyncEnd", "phaseAfter", "phaseBeforeStart"],
				},
				async content(event, trigger, player) {
					if (trigger.name == "phase") {
						if (player.countMark(event.name)) {
							player.clearMark(event.name, false);
						}
					}
					else {
						player.addMark(event.name, trigger.getg(player).length, false);
					}
				},
				intro: {
					content: "本回合已获得#张牌",
				},
				charlotte: true,
				mod: {
					cardEnabled(card, player) {
						if (game.hasPlayer(i => i != player && i.hasSkill("qlmuhui")) && player.countMark("qlmuhui_debuff") > 10) {
							return false;
						}
					},
					cardRespondable(card, player) {
						if (game.hasPlayer(i => i != player && i.hasSkill("qlmuhui")) && player.countMark("qlmuhui_debuff") > 10) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (game.hasPlayer(i => i != player && i.hasSkill("qlmuhui")) && player.countMark("qlmuhui_debuff") > 10) {
							return false;
						}
					}
				}
			},
			phase: {
				trigger: {
					global: ["phaseAfter"],
				},
				forced: true,
				filter(event, player) {
					return event.player != player;
				},
				async content(event, trigger, player) {
					player.insertPhase();
				}
			},
			def: {
				trigger: {
					player: ["turnOverBefore", "dieBefore", "discardBefore", "drawBefore"],
				},
				forced: true,
				filter(event, player) {
					if (event.name == "die") {
						return player.getHp() > 0;
					}
					if (event.name != "turnOver") {
						return event.getParent().name == "die" && event.getParent().source == player && event.getParent().player != player;
					}
					return true;
				},
				async content(event, trigger, player) {
					trigger.cancel();
				}
			}
		}
	},
	qltianguo: {
		persevereSkill: true,
		nobracket: true,
		forced: true,
		locked: false,
		trigger: {
			player: "phaseAnyBegin",
		},
		async content(event, trigger, player) {
			const card = get.autoViewAs({ name: "sha", nature: "kami", isCard: true });
			if (player.hasUseTarget(card, true, false)) {
				if (player.getHp() != 1) {
					await player.chooseUseTarget(card, true, false);
				}
				else {
					let targets = game.filterPlayer(target => player.canUse(card, target, true, false));
					targets = targets.randomGets(get.rand(1, targets.length));
					await player.useCard(card, targets, false);
				}
			}
			await player.draw(7);
		}
	},
	qlqicai: {
		persevereSkill: true,
		nobracket: true,
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			return player.hasCard(card => get.number(card) <= 7 && get.number(card) >= 1, "hes") && lib.inpile.includes(name);
		},
		getList(event, player) {
			return get.inpileVCardList(info => {
				return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
			});
		},
		filter(event, player) {
			return player.hasCard(card => get.number(card) <= 7 && get.number(card) >= 1, "hes") && get.info("qlqicai").getList(event, player).length > 0;
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.info("qlqicai").getList(event, player);
				return ui.create.dialog("七彩矢", [list, "vcard"], "hidden");
			},
			check(button) {
				if (get.event().getParent().type !== "phase") {
					return 1;
				}
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				return {
					audio: "qlqicai",
					popname: true,
					viewAs: { name: links[0][2], nature: links[0][3] },
					filterCard(card, player) {
						return get.number(card) <= 7 && get.number(card) >= 1;
					},
					position: "hes",
				};
			},
			prompt(links, player) {
				return "将一张点数1-7的牌当作" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用或打出";
			},
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
		group: ["qlqicai_draw"],
		subSkill: {
			draw: {
				forced: true,
				trigger: {
					player: "phaseBegin",
				},
				async content(event, trigger, player) {
					if (player.hp != 1) {
						await player.loseHp(24);
					}
					const targets = game.filterPlayer().sortBySeat();
					await game.doAsyncInOrder(targets, async target => {
						const num = 4 - target.countCards("h");
						if (num > 0) {
							return target.draw(num);
						}
						else if (num < 0) {
							return target.chooseToDiscard(-num, "h", true);
						}
					});
					const cards = [];
					for (let i = 1; i < 8; i++) {
						const card = get.cardPile2(card => get.number(card) == i, "random");
						if (card) {
							cards.push(card);
						}
					}
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				}
			},
		}
	},
	qlchanghong: {
		persevereSkill: true,
		nobracket: true,
		trigger: {
			player: "loseAfter",
			global: ["loseAsyncAfter", "gainAfter", "addToExpansionAfter", "addJudgeAfter", "equipAfter"],
		},
		filter(event, player) {
			return event.getl?.(player)?.cards2?.length > 1;
		},
		check: () => true,
		async content(event, trigger, player) {
			const cards = trigger.getl?.(player)?.cards2;
			const result = await player
				.judge(function (card) {
					const number = get.number(card);
					const evt = get.event().name == "judge" ? get.event() : get.event().getParent("judge", true);
					if (!evt) {
						return 0;
					}
					let val = 0;
					if (number >= 1 && number <= 4) {
						val += evt.cardsx.length;
					}
					if (number >= 4 && number <= 7) {
						val += evt.cardsx.filter(i => get.owner(i) && get.owner(i) != get.player()).length * 2;
					}
					return val;
				})
				.set("cardsx", cards)
				.forResult();
			const { card } = result;
			if (card) {
				const number = result.number;
				if (number >= 1 && number <= 4) {
					await player.draw(cards.length);
				}
				if (number >= 4 && number <= 7) {
					const map = new Map();
					cards.forEach(card => {
						const owner = get.owner(card);
						if (owner && owner != player) {
							if (!map.has(owner)) {
								map.set(owner, 0)
							}
							map.set(owner, map.get(owner) + 1);
						}
					});
					if (Array.from(map.values()).some(num => num > 0)) {
						await game.doAsyncInOrder(Array.from(map.keys()), async target => target.loseHp(map.get(target)));
					}
				}
			}
		},
		group: ["qlchanghong_judge"],
		subSkill: {
			judge: {
				trigger: {
					global: "judge",
				},
				async cost(event, trigger, player) {
					const top = Array.from(ui.cardPile.childNodes).slice(0, 7);
					const fake = game.createFakeCards(top);
					player.directgains(fake, null, event.skill);
					event.result = await player
						.chooseCard(`${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`, "hs")
						.set("ai", card => {
							const trigger = get.event().getTrigger();
							const { player, judging } = get.event();
							const result = trigger.judge(card) - trigger.judge(judging);
							const attitude = get.attitude(player, trigger.player);
							let val = get.value(card);
							if (get.subtype(card) == "equip2") {
								val /= 2;
							} else {
								val /= 4;
							}
							if (attitude == 0 || result == 0) {
								return 0;
							}
							if (attitude > 0) {
								return result - val;
							}
							return -result - val;
						})
						.set("judging", trigger.player.judging[0])
						.forResult();
					const { cards } = event.result;
					if (cards?.length) {
						for (let i = 0; i < cards.length; i++) {
							const card = cards[i];
							const real = top.find(i => i.cardid == card._cardid);
							if (real) {
								event.result.cards[i] = real;
							}
						}
					}
					game.deleteFakeCards(fake);
				},
				async content(event, trigger, player) {
					const { cards: [card] } = event;
					if (card) {
						trigger.fixedResult = {
							card: card,
							name: get.name(card),
							number: get.number(card),
							suit: get.suit(card),
							color: get.color(card),
						}
						game.log(trigger.player, "的判定结果固定为", card);
					}
				},
			},
		}
	},
	//黄忠
	qlfengjian: {
		mod: {
			maxHandcardBase(player, num) {
				return (num += player.getAttackRange());
			},
		},
		group: ["qlfengjian_qiangming", "qlfengjian_jiashang"],
		subSkill: {
			qiangming: {
				trigger: {
					player: "useCard",
				},
				audio: ["dczhanjue", 2],
				filter: function (event, player) {
					return game.hasPlayer(function (current) {
						return current != player && player.getAttackRange() >= current.getAttackRange();
					});
				},
				forced: true,
				async content(event, trigger, player) {
					trigger.directHit.addArray(
						game.filterPlayer(function (current) {
							return current != player && player.getAttackRange() >= current.getAttackRange();
						})
					);
				},
				sub: true,
				sourceSkill: "qlfengjian",
				_priority: 0,
				skill_id: "qlfengjian_qiangming",
			},
			jiashang: {
				trigger: {
					source: "damageBegin1",
				},
				audio: ["dczhanjue", 2],
				forced: true,
				filter: function (event, player, card) {
					return event.card.name == "sha" && event.player.getAttackRange() <= player.getAttackRange();
				},
				async content(event, trigger, player) {
					trigger.num++;
				},
				sub: true,
				sourceSkill: "qlfengjian",
				_priority: 0,
				skill_id: "qlfengjian_jiashang",
			},
		},
		_priority: 0,
		skill_id: "qlfengjian",
	},
	qlguanshi: {
		trigger: {
			source: "damageBegin2",
		},
		audio: ["new_dclieqiong", 2],
		async content(event, trigger, player) {
			await player.loseHp();
			trigger.num++;
		},
		_priority: 0,
		skill_id: "qlguanshi",
	},
	//初七
	zhusui: {
		persevereSkill: true,
		superCharlotte: true,
		intro: {
			name2: "珠",
			content: "mark",
		},
		marktext: "珠",
		audio: "ext:初七:2",
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return player.countMark("zhusui");
		},
		async cost(event, trigger, player) {
			const limit = player.countMark("zhusui");
			const choices = Array.from({
				length: limit,
			}).map((_, i) => [i, get.cnNumber(i + 1, true)]);
			//const history = game.getAllGlobalHistory("everything", evt => evt.name == "xinjilve" && evt.player == player && Array.isArray(evt.cost_data) && get.info("xinbaiyin").derivation.includes(evt.cost_data[0]));
			const skills = ["cq_huoji", "cq_poxi", "cq_mingfa", "cq_jianying"].filter(skill => player.countMark(skill) < 2);
			const num = skills.some(skill => !player.hasSkill(skill)) ? 2 : Math.min(...skills.map(skill => player.countMark(skill))) + 2;
			if (skills.length && limit >= num) {
				const next = player.chooseButton(2, ["珠碎：请选择你要移去的“珠碎”标记数和相应操作", '<div class="text center">移去“珠碎”标记数</div>', [choices, "tdnodes"], '<div class="text center">执行的操作</div>', [skills.map(i => [i, `获得或升级【${get.translation(i)}】`]).concat(["摸牌"]), "tdnodes"]]);
				next.set("filterButton", button => {
					const link = button.link;
					if (Boolean(ui.selected.buttons.length) !== (typeof link == "number")) {
						return false;
					}
					if (ui.selected.buttons.length) {
						const link2 = ui.selected.buttons[0].link;
						if (ui.selected.buttons[0].link == "摸牌") {
							return link <= 6;
						}
						return link == player.countMark(link2) + 1;
						//return link == get.event().num - 1;
					}
					return true;
				});
				next.set("ai", button => {
					const link = button.link,
						num = get.event().num,
						skills = get.event().skills;
					if (!ui.selected.buttons.length) {
						if (num > 2 && link == "摸牌" && player.hasSkill("cq_jianying")) {
							return 10;
						}
						if (link == "cq_jianying" && player.countCards("h") > 4) {
							return 50;
						}
						if (link == "cq_mingfa" && player.countCards("h") < 4) {
							return 50;
						}
						if (player.countMark("xinrenjie") <= 2) {
							return 0;
						}
					}
					return ui.selected.buttons.length && ui.selected.buttons[0].link == "摸牌" ? player.countMark("zhusui") : 1;
				});
				//next.set("num", num);
				next.set("skills", skills);
				const { bool, links } = await next.forResult();
				event.result = {
					bool: bool,
					cost_data: links,
				};
			} else {
				const draw = Array.from({
					length: Math.min(7, limit),
				}).map((_, i) => get.cnNumber(i + 1, true));
				const result = await player
					.chooseControl(draw, "cancel2")
					.set("prompt", get.prompt("zhusui"))
					.set("prompt2", `你可以移去至多${get.cnNumber(draw.length)}枚“珠碎”标记并摸等量张牌`)
					.set("ai", () => {
						return get.event().choice;
					})
					.set(
						"choice",
						(function () {
							if (!player.hasSkill("rejizhi", null, null, false)) {
								return "cancel2";
							}
							return choices.length - 1;
						})()
					).forResult();
				event.result = {
					bool: result.control != "cancel2",
					cost_data: result.index,
				};
			}
		},
		async content(event, trigger, player) {
			const choice = event.cost_data;
			if (typeof choice == "number") {
				player.removeMark("zhusui", choice + 1);
				await player.draw(choice + 1);
			} else if (["cq_huoji", "cq_poxi", "cq_mingfa", "cq_jianying"].includes(choice[0])) {
				const skills = ["cq_huoji", "cq_poxi", "cq_mingfa", "cq_jianying"].filter(skill => player.countMark(skill) < 2);
				const num = skills.some(skill => !player.hasSkill(skill)) ? 2 : Math.min(...skills.map(skill => player.countMark(skill))) + 2;
				player.removeMark("zhusui", player.countMark(choice[0]) + 2);
				game.log(choice[0]);
				if (!player.hasSkill(choice[0])) {
					await player.addSkills(choice[0]);
				} else {
					await player.addMark(choice[0]);
				}
			} else {
				player.removeMark("zhusui", choice[1] + 1);
				await player.draw(choice[1] + 1);
			}
		},
		group: ["zhusui_gain", "xinrenjie_change"],
		subSkill: {
			gain: {
				trigger: {
					global: "phaseBefore",
					player: ["enterGame", "damageEnd"],
					source: "damageEnd",
				},
				filter(event, player) {
					if (event.name == "damage") {
						return true;
					}
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				async content(event, trigger, player) {
					if (trigger.name == "damage") {
						await player.addMark("zhusui", trigger.num);
						return;
					}
					let skills = ["qlweiye"];
					const groupList = new Map([
						["wei", "cq_mingfa"],
						["shu", "cq_huoji"],
						["wu", "cq_poxi"],
						["qun", "cq_jianying"],
						["key", "hiroto_zonglve"],
					]);
					if (Array.from(groupList.keys()).includes(player.group)) {
						skills.push(groupList.get(player.group));
					}
					skills = skills.filter(skill => !player.hasSkill(skill, null, null, false));
					if (skills.length) {
						await player.addSkills(skills);
					}
					await player.drawTo(7);
				},
				skill_id: "zhusui_gain",
				sub: true,
				sourceSkill: "zhusui",
				_priority: 0,
			},
		},
		ai: {
			notemp: true,
		},
		skill_id: "zhusui",
		_priority: 0,
	},
	cq_huoji: {
		enable: ["chooseToUse", "chooseToRespond"],
		filter(event, player) {
			if (!player.countCards("he")) {
				return false;
			}
			for (var i of lib.inpile) {
				if ((i == "huogong" || i == "sha") && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i of lib.inpile) {
					const type = get.type2(i);
					if ((i == "huogong" || (i == "sha" && player.countMark("cq_huoji"))) && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
						list.push([type, "", i, "fire"]);
					}
				}
				return ui.create.dialog("火计", [list, "vcard"]);
			},
			backup(links, player) {
				var next = {
					audio: "huoji",
					filterCard: function (card) {
						const player = get.player();
						return get.color(card) == "red" || player.countMark("cq_huoji") >= 2;
					},
					popname: true,
					position: "he",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					ai1(card) {
						return 7 - _status.event.player.getUseValue(card, null, true);
					},
					async precontent(event, trigger, player) {
						if (player.countMark("cq_huoji") >= 2) {
							event.getParent().addCount = false;
						}
					},
				};
				return next;
			},
			prompt(links) {
				return "将一张牌当做" + (get.translation(links[0][3]) || "") + (get.translation(links[0][2]) + "") + "使用";
			},
		},
	},
	cq_poxi: {
		audio: "ext:初七:2",
		enable: "phaseUse",
		filter(event, player) {
			return !player.hasSkill("cq_poxi_ban");
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
			//return target!=player;
		},
		content() {
			"step 0";
			event.list1 = [];
			event.list2 = [];
			if (player.countCards("h") > 0) {
				var chooseButton = player.chooseButton(4, ["你的手牌", player.getCards("h"), get.translation(target.name) + "的手牌", target.getCards("h")]);
			} else {
				var chooseButton = player.chooseButton(4, [get.translation(target.name) + "的手牌", target.getCards("h")]);
			}
			chooseButton.set("target", target);
			chooseButton.set("ai", function (button) {
				var player = _status.event.player;
				var target = _status.event.target;
				var ps = [];
				var ts = [];
				for (var i = 0; i < ui.selected.buttons.length; i++) {
					var card = ui.selected.buttons[i].link;
					if (target.getCards("h").includes(card)) {
						ts.push(card);
					} else {
						ps.push(card);
					}
				}
				var card = button.link;
				var owner = get.owner(card);
				var val = get.value(card) || 1;
				if (owner == target) {
					if (ts.length > 1) {
						return 0;
					}
					if (ts.length == 0 || player.hp > 3) {
						return val;
					}
					return 2 * val;
				}
				return 7 - val;
			});
			chooseButton.set("filterButton", function (button) {
				if (get.owner(button.link) && !lib.filter.canBeDiscarded(button.link, get.owner(button.link), get.player())) {
					return false;
				}
				for (var i = 0; i < ui.selected.buttons.length; i++) {
					if (get.suit(button.link) == get.suit(ui.selected.buttons[i].link)) {
						return false;
					}
				}
				return true;
			});
			("step 1");
			if (result.bool) {
				var list = result.links;
				for (var i = 0; i < list.length; i++) {
					if (get.owner(list[i]) == player) {
						event.list1.push(list[i]);
					} else {
						event.list2.push(list[i]);
					}
				}
				if (event.list1.length && event.list2.length) {
					game.loseAsync({
						lose_list: [
							[player, event.list1],
							[target, event.list2],
						],
						discarder: player,
					}).setContent("discardMultiple");
				} else if (event.list2.length) {
					target.discard(event.list2);
				} else {
					player.discard(event.list1);
				}
			}
			("step 2");
			var level = player.countMark(event.name);
			var length = event.list1.length;
			if (event.list1.length + event.list2.length == 4) {
				if (event.list1.length == 0) {
					player.turnOver();
				}
				if (event.list1.length == 1 && level == 0) {
					player.loseHp();
				}
				if ((event.list1.length == 3 && level == 0) || (length == 2 && level != 0) || (length == 4 && level != 0)) {
					player.recover();
				}
				if (event.list1.length == 4 || (length == 3 && level != 0)) {
					player.draw(level != 0 && length == 4 ? 5 : 4);
				}
				if (!(length == 4 && level == 2)) {
					player.addTempSkill(event.name + "_ban");
				}
			}
		},
		ai: {
			order: 6,
			result: {
				target(target, player) {
					return -1;
				},
			},
		},
		skill_id: "drlt_poxi",
		_priority: 0,
	},
	cq_mingfa: {
		audio: "ext:初七:2",
		trigger: {
			player: "useCardAfter",
		},
		direct: true,
		filter(event, player) {
			return player.isPhaseUsing() && (event.card.name == "sha" || get.type(event.card) == "trick") && event.cards.filterInD().length > 0 && !player.getExpansions("dcmingfa").length;
		},
		content() {
			"step 0";
			var str,
				cards = trigger.cards.filterInD(),
				card = trigger.card;
			if (cards.length == 1 && card.name == cards[0].name && (card.nature || false) == (cards[0].nature || false)) {
				str = get.translation(cards[0]);
			} else {
				str = get.translation(trigger.card) + "（" + get.translation(cards) + "）";
			}
			var cardx = {
				name: trigger.card.name,
				nature: trigger.card.nature,
				isCard: true,
			};
			player
				.chooseTarget(lib.filter.notMe, get.prompt("dcmingfa"), "将" + str + "作为“明伐”牌置于武将牌上，并选择一名其他角色。该角色下回合结束时对其执行〖明伐〗的后续效果。")
				.set("card", cardx)
				.set(
					"goon",
					(function () {
						var getMax = function (card) {
							return Math.max.apply(
								Math,
								game
									.filterPlayer(function (current) {
										return current != player && lib.filter.targetEnabled2(card, player, current);
									})
									.map(function (i) {
										return get.effect(i, card, player, player) * Math.sqrt(Math.min(i.getHandcardLimit(), 1 + i.countCards("h")));
									})
									.concat([0])
							);
						};
						var eff1 = getMax(cardx);
						if (
							player.hasCard(function (card) {
								if ((card.name != "sha" && get.type(card) != "trick") || !player.hasValueTarget(card, null, true)) {
									return false;
								}
								return (
									getMax({
										name: get.name(card),
										nature: get.nature(card),
										isCard: true,
									}) >= eff1
								);
							}, "hs")
						) {
							return false;
						}
						return true;
					})()
				)
				.set("ai", function (target) {
					if (!_status.event.goon) {
						return 0;
					}
					var player = _status.event.player,
						card = _status.event.card;
					if (!lib.filter.targetEnabled2(card, player, target)) {
						return 0;
					}
					return get.effect(target, card, player, player) * Math.sqrt(Math.min(target.getHandcardLimit(), 1 + target.countCards("h")));
				});
			("step 1");
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("dcmingfa", target);
				var card = {
					name: trigger.card.name,
					nature: trigger.card.nature,
					isCard: true,
				};
				player.storage.dcmingfa_info = [card, target];
				player.addToExpansion(trigger.cards.filterInD(), "gain2").gaintag.add("dcmingfa");
			}
		},
		group: "dcmingfa_use",
		ai: {
			expose: 0.2,
		},
		intro: {
			mark(dialog, storage, player) {
				var cards = player.getExpansions("dcmingfa");
				if (!cards.length) {
					return "没有“明伐”牌";
				} else {
					dialog.add(cards);
				}
				var info = player.storage.dcmingfa_info;
				if (info) {
					dialog.addText("记录牌：" + get.translation(info[0]) + "<br>记录目标：" + get.translation(info[1]));
				}
			},
			content: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
			delete player.storage.dcmingfa_info;
		},
		subSkill: {
			use: {
				audio: "dcmingfa",
				trigger: {
					global: ["phaseEnd", "die"],
				},
				forced: true,
				filter(event, player) {
					if (!player.storage.dcmingfa_info || !player.getExpansions("dcmingfa").length) {
						return false;
					}
					return event.player == player.storage.dcmingfa_info[1];
				},
				content() {
					"step 0";
					var target = trigger.player;
					event.target = target;
					var card = player.storage.dcmingfa_info[0];
					delete player.storage.dcmingfa_info;
					event.card = card;
					event.count = Math.max(1, Math.min(5, target.countCards("h")));
					if (!event.player.isIn()) {
						event.goto(2);
					}
					("step 1");
					event.count--;
					if (target.isIn() && lib.filter.targetEnabled2(card, player, target)) {
						player.useCard(get.copy(card), target);
						if (event.count > 0) {
							event.redo();
						}
					}
					("step 2");
					var cards = player.getExpansions("dcmingfa");
					if (cards.length > 0) {
						player.loseToDiscardpile(cards);
					}
				},
				skill_id: "dcmingfa_use",
				sub: true,
				sourceSkill: "dcmingfa",
				_priority: 0,
			},
		},
		skill_id: "dcmingfa",
		_priority: 0,
	},
	cq_jianying: {
		audio: "ext:初七:2",
		subfrequent: ["draw"],
		enable: "chooseToUse",
		usable: 1,
		filter(event, player) {
			if (_status.currentPhase != player && player.countMark("cq_jianying") < 2) {
				return false;
			}
			if (!player.countCards("he")) {
				return false;
			}
			for (var i of lib.inpile) {
				if (i != "du" && get.type(i, null, false) == "basic") {
					if (event.filterCard({ name: i }, player, event)) {
						return true;
					}
					if (i == "sha") {
						for (var j of lib.inpile_nature) {
							if (event.filterCard({ name: i, nature: j }, player, event)) {
								return true;
							}
						}
					}
				} else if (get.type(i, null, false) == "trick" && event.filterCard({ name: i }, player, event) && player.countMark("cq_jianying") >= 1) {
					return true;
				} else if (get.type(i, null, false) == "delay" && event.filterCard({ name: i }, player, event) && player.countMark("cq_jianying") >= 2) {
					return true;
				}
			}
			return false;
		},
		onChooseToUse(event) {
			if (!game.online) {
				var last = lib.skill.dcjianying.getLastUsed(event.player);
				if (last && last.card) {
					var suit = get.suit(last.card, false);
					if (suit != "none") {
						event.set("cq_jianying_suit", suit);
					}
				}
			}
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				var suit = event.cq_jianying_suit || "",
					str = get.translation(suit);
				for (var i of lib.inpile) {
					if (i != "du" && get.type(i, null, false) == "basic") {
						if (event.filterCard({ name: i }, player, event)) {
							list.push(["基本", str, i]);
						}
						if (i == "sha") {
							for (var j of lib.inpile_nature) {
								if (event.filterCard({ name: i, nature: j }, player, event)) {
									list.push(["基本", str, i, j]);
								}
							}
						}
					} else if (get.type(i, null, false) == "trick" && event.filterCard({ name: i }, player, event) && player.countMark("cq_jianying") >= 1) {
						list.push(["锦囊", str, i]);
					} else if (get.type(i, null, false) == "delay" && event.filterCard({ name: i }, player, event) && player.countMark("cq_jianying") >= 2) {
						list.push(["锦囊", str, i]);
					}
				}
				return ui.create.dialog("渐营", [list, "vcard"]);
			},
			check(button) {
				if (button.link[2] == "jiu") {
					return 0;
				}
				return _status.event.player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
				});
			},
			backup(links, player) {
				var next = {
					audio: "xinjianying",
					filterCard: true,
					popname: true,
					position: "he",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					ai1(card) {
						return 7 - _status.event.player.getUseValue(card, null, true);
					},
				};
				if (_status.event.cq_jianying_suit) {
					next.viewAs.suit = _status.event.cq_jianying_suit;
				}
				return next;
			},
			prompt(links) {
				return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + (_status.event.cq_jianying_suit ? "(" + get.translation(_status.event.cq_jianying_suit) + ")" : "") + "使用";
			},
		},
		ai: {
			order(item, player) {
				if (_status.event.cq_jianying_suit) {
					return 16;
				}
				return 3;
			},
			result: {
				player: 7,
			},
		},
		group: ["cq_jianying_draw", "jianying_mark"],
		init(player) {
			if (player.isPhaseUsing()) {
				var evt = _status.event.getParent("phaseUse");
				var history = player.getHistory("useCard", function (evt2) {
					return evt2.getParent("phaseUse") == evt;
				});
				if (history.length) {
					var trigger = history[history.length - 1];
					player.storage.jianying_mark = trigger.card;
					player.markSkill("jianying_mark");
					game.broadcastAll(
						function (player, suit) {
							if (player.marks.jianying_mark) {
								player.marks.jianying_mark.firstChild.innerHTML = get.translation(suit);
							}
						},
						player,
						get.suit(trigger.card, player)
					);
					player.when("phaseUseAfter").then(() => {
						player.unmarkSkill("jianying_mark");
						delete player.storage.jianying_mark;
					});
				}
			}
		},
		onremove(player) {
			player.unmarkSkill("jianying_mark");
			delete player.storage.jianying_mark;
		},
		subSkill: {
			draw: {
				inherit: "jianying",
				audio: "xinjianying",
				skill_id: "xinjianying_draw",
				sub: true,
				sourceSkill: "xinjianying",
				locked: false,
				mod: {
					aiOrder(player, card, num) {
						if (typeof card == "object" && player.isPhaseUsing()) {
							var evt = player.getLastUsed();
							if (!evt || !evt.card || evt.getParent("phaseUse") !== _status.event.getParent("phaseUse")) {
								return num;
							}
							if ((get.suit(evt.card) && get.suit(evt.card) == get.suit(card)) || (evt.card.number && evt.card.number == get.number(card))) {
								return num + 10;
							}
						}
					},
				},
				trigger: {
					player: "useCard",
				},
				frequent: true,
				filter(event, player) {
					if (player.countMark("cq_jianying")) {
						var evt = lib.skill.dcjianying.getLastUsed(player, event);
						if (!evt || !evt.card) {
							return false;
						}
						return (lib.suit.includes(get.suit(evt.card)) && get.suit(evt.card) == get.suit(event.card)) || (typeof get.number(evt.card, false) == "number" && get.number(evt.card, false) == get.number(event.card));
					} else {
						if (!player.isPhaseUsing()) {
							return false;
						}
						player.addTip("jianying", "渐营 " + get.translation(get.suit(event.card, player)) + get.translation(get.strNumber(get.number(event.card, player))), true);
						var evt = player.getLastUsed(1);
						if (!evt || !evt.card) {
							return false;
						}
						var evt2 = evt.getParent("phaseUse");
						if (!evt2 || evt2.name != "phaseUse" || evt2 !== event.getParent("phaseUse")) {
							return false;
						}
						return (get.suit(evt.card) != "none" && get.suit(evt.card) == get.suit(event.card)) || (typeof get.number(evt.card, false) == "number" && get.number(evt.card, false) == get.number(event.card));
					}
				},
				content() {
					player.draw("nodelay");
				},
				group: "jianying_mark",
				init(player) {
					if (player.isPhaseUsing()) {
						var evt = _status.event.getParent("phaseUse");
						var history = player.getHistory("useCard", function (evt2) {
							return evt2.getParent("phaseUse") == evt;
						});
						if (history.length) {
							var trigger = history[history.length - 1];
							if (get.suit(trigger.card, player) == "none" || typeof get.number(trigger.card, player) != "number") {
								return;
							}
							player.storage.jianying_mark = trigger.card;
							player.markSkill("jianying_mark");
							game.broadcastAll(
								function (player, suit) {
									if (player.marks.jianying_mark) {
										player.marks.jianying_mark.firstChild.innerHTML = get.translation(suit);
									}
								},
								player,
								get.suit(trigger.card, player)
							);
							player.when("phaseUseAfter").then(() => {
								player.unmarkSkill("jianying_mark");
								delete player.storage.jianying_mark;
							});
						}
					}
				},
				onremove(player) {
					player.unmarkSkill("jianying_mark");
					delete player.storage.jianying_mark;
				},
				subSkill: {
					mark: {
						charlotte: true,
						trigger: {
							player: "useCard1",
						},
						filter(event, player) {
							return player.isPhaseUsing();
						},
						forced: true,
						popup: false,
						firstDo: true,
						content() {
							if (get.suit(trigger.card, player) == "none" || typeof get.number(trigger.card, player) != "number") {
								player.unmarkSkill("jianying_mark");
							} else {
								player.storage.jianying_mark = trigger.card;
								player.markSkill("jianying_mark");
								game.broadcastAll(
									function (player, suit) {
										if (player.marks.jianying_mark) {
											player.marks.jianying_mark.firstChild.innerHTML = get.translation(suit);
										}
									},
									player,
									get.suit(trigger.card, player)
								);
								player.when("phaseUseAfter").then(() => {
									player.unmarkSkill("jianying_mark");
									delete player.storage.jianying_mark;
								});
							}
						},
						intro: {
							markcount(card, player) {
								return get.strNumber(get.number(card, player));
							},
							content(card, player) {
								var suit = get.suit(card, player);
								var num = get.number(card, player);
								var str = "<li>上一张牌的花色：" + get.translation(suit);
								str += "<br><li>上一张牌的点数：" + get.strNumber(num);
								return str;
							},
						},
						skill_id: "jianying_mark",
						sub: true,
						sourceSkill: "jianying",
						_priority: 0,
					},
				},
				_priority: 0,
			},
		},
		skill_id: "xinjianying",
	},
	//沮授
	qlshipan: {
		trigger: {
			global: "phaseJieshuBegin",
		},
		audio: ["xinjianying", 2],
		filter(event, player) {
			return event.player.getHistory("useCard", card => card.card.name == "sha").length != 1;
		},
		async content(event, trigger, player) {
			const target = trigger.player;
			await target.damage();
			const result = await player
				.chooseTarget(function (card, player, target) {
					return target != trigger.player;
				})
				.forResult();
			await player.draw();
			if (result.bool) {
				await result.targets[0].draw();
			}
		},
		_priority: 0,
		skill_id: "qlshipan",
	},
	qlkangfu: {
		trigger: {
			global: "phaseBefore",
			player: ["enterGame", "dying", "dieBegin"],
		},
		audio: "dcsbmuwang",
		filter(event, player) {
			if (event.name == "dying") {
				return true;
			}
			if (event.name == "die") {
				return event.getParent().name != "giveup" && player.maxHp > 0;
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.name == "dying" || trigger.name == "die") {
				const result = await player
					.chooseTarget("###慷赴：是否令一名角色摸三张牌？###若如此做，你脱离濒死时你与其各弃置一张牌")
					.set("ai", target => {
						const player = get.player();
						return get.attitude(player, target);
					})
					.forResult();
				if (result?.bool && result.targets?.length) {
					const target = result.targets[0];
					await target.draw(3);
					const evtx = trigger.name == "die" ? trigger.getParent() : trigger;
					player
						.when("dyingAfter")
						.filter(evt => evt == evtx)
						.step(async (event, trigger, player) => {
							const func = async target => {
								if (target?.isIn() && target.countDiscardableCards(target, "he")) {
									await target.chooseToDiscard("he", true);
								}
							};
							await game.doAsyncInOrder([player, target], func);
						});
				}
				if (trigger?.reason?.name == "damage") {
					return;
				}
				await player.recoverTo(1);
				if (trigger.name == "die" && player.hp > 0) {
					trigger.cancel();
				}
			} else {
				await player.addSkills("shibei");
			}
		},
	},
	//曾侯乙编钟
	qlsanyin: {
		group: ["qlsanyin_jiyin", "qlsanyin_xuanyin", "qlsanyin_qingyin", "qlsanyin_zhizhi"],
		list: ["jiyin", "xuanyin", "qingyin"].map(i => `qlsanyin_${i}`),
		subSkill: {
			jiyin: {
				marktext: "激",
				intro: {
					name: "激音",
					name2: "激音",
					markcount: "mark",
					content: "造成的伤害+1",
				},
				forced: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					if (!player.hasSkill("qlsanyin") && !player.hasMark("qlsanyin_jiyin")) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					if (!player.hasMark(event.name)) {
						player.addMark(event.name);
					} else {
						player.removeMark(event.name);
						trigger.num++;
					}
				},
			},
			xuanyin: {
				marktext: "旋",
				intro: {
					name: "旋音",
					name2: "旋音",
					markcount: "mark",
					content: "受到的伤害-1",
				},
				forced: true,
				trigger: { player: "damageBegin3" },
				filter(event, player) {
					if (!player.hasSkill("qlsanyin") && !player.hasMark("qlsanyin_xuanyin")) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					if (!player.hasMark(event.name)) {
						player.addMark(event.name);
					} else {
						player.removeMark(event.name);
						trigger.num--;
					}
				},
			},
			qingyin: {
				marktext: "清",
				intro: {
					name: "清音",
					name2: "清音",
					markcount: "mark",
					content: "回复的体力+1",
				},
				forced: true,
				trigger: { player: "recoverBegin" },
				filter(event, player) {
					if (!player.hasSkill("qlsanyin") && !player.hasMark("qlsanyin_qingyin")) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					if (!player.hasMark(event.name)) {
						player.addMark(event.name);
					} else {
						player.removeMark(event.name);
						trigger.num++;
					}
				},
			},
			zhizhi: {
				forced: true,
				trigger: { player: "addMark" },
				filter(event, player) {
					return (
						game.openZhizhi() &&
						game
							.getRoundHistory("everything", evt => {
								if (evt.name != "addMark" || evt.player != player) {
									return false;
								}
								return get.info("qlsanyin").list.includes(evt.markName);
							})
							.indexOf(event) == 0
					);
				},
				async content(event, trigger, player) {
					const list = get.info("qlsanyin").list.filter(i => !player.hasMark(i));
					if (!list.length) {
						await player.draw(2);
					} else {
						const result = await player
							.chooseControl(list.map(i => get.info(i).intro.name))
							.set("choiceList", [`激音：造成的伤害+1`, `旋音：受到的伤害-1`, `清音：回复的体力+1`])
							.set("displayIndex", false)
							.set("prompt", "三音：请选择一个未获得的标记获得之")
							.forResult();
						if (result?.control) {
							player.addMark(list[result.index]);
						}
					}
				},
			},
		},
	},
	qljili: {
		enable: "phaseUse",
		usable: 1,
		zhuanhuanji: true,
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				if (!storage) {
					return `出牌阶段限一次，你可以令一名角色摸两张牌并令其受到一点无来源伤害。然后其获得你对应的三音标记和对应效果，最后你对另一名角色造成一点伤害。`;
				}
				return `出牌阶段限一次，你可以令一名角色摸两张牌并令其回复一点体力。然后其获得你对应的三音标记和对应效果，最后你对另一名角色造成一点伤害。`;
			},
		},
		filterTarget: true,
		async content(event, trigger, player) {
			const { target } = event;
			const bool = player.storage[event.name];
			player.changeZhuanhuanji(event.name);
			await target.draw(2);
			if (!bool) {
				await target.damage("nosource");
			} else {
				await target.recover();
			}
			const list = get.info("qlsanyin").list.filter(i => !target.hasMark(i) && player.hasMark(i));
			if (list.length) {
				list.forEach(i => {
					target.addTempSkill(i, { player: "dieAfter" });
					target.addMark(i);
				});
			}
			if (game.hasPlayer(targetx => targetx != target)) {
				const result = await player
					.chooseTarget(`祭礼：对另一名角色造成一点伤害`, true, (card, player, target) => {
						return target != get.event().excluded;
					})
					.set("excluded", target)
					.set("ai", target => get.damageEffect(target, get.player(), get.player()))
					.forResult();
				if (result?.targets?.length) {
					const [target] = result.targets;
					player.line(target, "yellow");
					await target.damage();
				}
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (!player.storage.qljili) {
						return target.hp;
					}
					return 114514 - target.hp;
				},
			},
		},
	},
	qldubu: {
		group: ["qldubu_fengshi", "qldubu_liuwen"],
		trigger: {
			player: ["useCard", "respond"],
		},
		audio: "ext:五花米线/audio/skill:4",
		forced: true,
		filter(event, player) {
			return event.card.name == "sha" && event.card.color;
		},
		async content(event, trigger, player) {
			if (trigger.card.color == "black") {
				player.addMark("qldubu_liuwen");
			} else if (trigger.card.color == "red") {
				player.addMark("qldubu_fengshi");
			}
			var num = player.countMark("qldubu_fengshi") + player.countMark("qldubu_liuwen");
			if (num % 3 == 0 && num != 0) {
				player.draw(3);
				player.recover();
				player.insertPhase();
			}
		},
		subSkill: {
			fengshi: {
				mark: true,
				marktext: "峰",
				intro: {
					name: "峰石",
					content: "mark",
				},
				sub: true,
				sourceSkill: "qldubu",
				_priority: 0,
				skill_id: "qldubu_fengshi",
			},
			liuwen: {
				mark: true,
				marktext: "流",
				intro: {
					name: "流纹",
					content: "mark",
				},
				sub: true,
				sourceSkill: "qldubu",
				_priority: 0,
				skill_id: "qldubu_liuwen",
			},
		},
		_priority: 0,
		skill_id: "qldubu",
	},
	qlchongluan: {
		enable: "phaseUse",
		usable: 1,
		audio: "ext:五花米线/audio/skill:1",
		async content(event, trigger, player) {
			var num = player.countMark("qldubu_fengshi") + player.countMark("qldubu_liuwen");
			if (num >= 3) {
				const choices = [
					//创建一个数组用来存储选项名称
					"3峰0流",
					"2峰1流",
					"1峰2流",
					"0峰3流",
					"cancel2",
				];
				const choiceList = [
					//创建一个数组用来存储选项描述
					"额外造成3点伤害",
					"额外造成1点伤害，赋予“受到伤害后流失一点体力”，持续一轮",
					"额外指定一个目标，目标受到的火焰伤害+1，持续一轮",
					"额外指定一个目标，目标翻面",
				];
				if (player.countMark("qldubu_fengshi") < 3) {
					choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
					choices.remove("3峰0流");
				}
				if (player.countMark("qldubu_fengshi") < 2 || player.countMark("qldubu_liuwen") < 1) {
					choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
					choices.remove("2峰1流");
				}
				if (player.countMark("qldubu_fengshi") < 1 || player.countMark("qldubu_liuwen") < 2) {
					choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "</span>";
					choices.remove("1峰2流");
				}
				if (player.countMark("qldubu_liuwen") < 3) {
					choiceList[3] = '<span style="opacity:0.5">' + choiceList[3] + "</span>";
					choices.remove("0峰3流");
				}
				var result2 = await player
					.chooseControl()
					.set("prompt", "重峦：选择是否失去对应数量的标记")
					.set("controls", choices)
					.set("choiceList", choiceList)
					.set("ai", () => {
						return [0, 1, 2, 3].randomGet();
					})
					.forResult();
				if (result2.control) {
					if (result2.control == "3峰0流" || result2.control == "2峰1流") {
						var cl_prompt = "";
						if (result2.control == "3峰0流") {
							cl_prompt = "请选择一个目标，目标受到3点伤害。";
						}
						if (result2.control == "2峰1流") {
							cl_prompt = "请选择一个目标，目标受到2点伤害，并获得“受到伤害后流失一点体力”效果。";
						}
						var result3 = await player
							.chooseTarget(get.prompt2(cl_prompt), function (card, player, target) {
								return target != player;
							})
							.set("ai", function (target) {
								return 10 - get.attitude(_status.event.player, target);
							})
							.forResult();
						if (result3.bool) {
							var target = result3.targets[0];
							if (result2.control == "3峰0流") {
								target.damage(4);
								player.removeMark("qldubu_fengshi", 3);
							}
							if (result2.control == "2峰1流") {
								target.damage(2);
								target.addTempSkill("qlchongluan_2f1l_buff", { player: "phaseBefore" });
								player.removeMark("qldubu_fengshi", 2);
								player.removeMark("qldubu_liuwen", 1);
							}
						}
					} else if (result2.control == "1峰2流" || result2.control == "0峰3流") {
						var cl_prompt = "";
						if (result2.control == "1峰2流") {
							cl_prompt = "请选择两个目标，目标受到1点伤害，并获得“受到的火焰伤害+1”。";
						}
						if (result2.control == "0峰3流") {
							cl_prompt = "请选择两个目标，目标受到1点伤害，并翻面。";
						}
						var result4 = await player
							.chooseTarget([1, 2], get.prompt2(cl_prompt), function (card, player, target) {
								return target != player;
							})
							.set("ai", function (target) {
								return 10 - get.attitude(_status.event.player, target);
							})
							.forResult();
						if (result4.bool) {
							var targets = result4.targets;
							if (result2.control == "1峰2流") {
								for (var i = 0; i < targets.length; i++) {
									targets[i].damage(1);
									targets[i].addTempSkill("qlchongluan_1f2l_buff", { player: "phaseBefore" });
								}
							}
							player.removeMark("qldubu_fengshi", 1);
							player.removeMark("qldubu_liuwen", 2);
						}
						if (result2.control == "0峰3流") {
							for (var i = 0; i < targets.length; i++) {
								targets[i].damage(1);
								targets[i].turnOver();
							}
							player.removeMark("qldubu_liuwen", 3);
						}
					}
				}
			} else {
				var result2 = await player
					.chooseTarget(get.prompt2("选择一名角色，对其造成1点伤害"), function (card, player, target) {
						return target != player;
					})
					.set("ai", function (target) {
						return 10 - get.attitude(_status.event.player, target);
					})
					.forResult();
				if (result2.bool) {
					var target = result2.targets[0];
					target.damage(1);
				}
			}
			var result1 = await player
				.chooseControl("峰石", "流纹", "取消")
				.set("prompt2", "选择一个获得的标记")
				.set("ai", () => {
					return ["峰石", "流纹"].randomGet();
				})
				.forResult();
			if (result1.control == "峰石") {
				player.addMark("qldubu_fengshi");
			} else if (result1.control == "流纹") {
				player.addMark("qldubu_liuwen");
			}
			var num = player.countMark("qldubu_fengshi") + player.countMark("qldubu_liuwen");
			if (num % 3 == 0 && num != 0) {
				player.draw(3);
				player.recover();
				player.insertPhase();
			}
		},
		subSkill: {
			"2f1l_buff": {
				charlotte: true,
				marktext: "峰",
				intro: {
					name: "峰石",
					content: "锁定技。当你受到伤害后，你流失一点体力。",
					onunmark: true,
				},
				trigger: {
					player: "damageEnd",
				},
				forced: true,
				content() {
					player.loseHp();
				},
				sub: true,
				sourceSkill: "qlchongluan",
				_priority: 0,
				skill_id: "qlchongluan_2f1l_buff",
			},
			"1f2l_buff": {
				charlotte: true,
				marktext: "流",
				intro: {
					name: "流纹",
					content: "锁定技。你受到火焰伤害时，伤害+1。",
					onunmark: true,
				},
				trigger: {
					player: "damageBegin1",
				},
				forced: true,
				filter(event, player) {
					return event.hasNature("fire");
				},
				async content(event, trigger, player) {
					trigger.num++;
				},
				sub: true,
				sourceSkill: "qlchongluan",
				_priority: 0,
				skill_id: "qlchongluan_1f2l_buff",
			},
		},
		ai: {
			order: 9,
			result: {
				player: 1,
			},
		},
		_priority: 0,
		skill_id: "qlchongluan",
	},
	qlzhuwei: {
		audio: "drlt_jueyan",
		trigger: {
			global: ["roundStart", "useCard"],
		},
		filter(event, player) {
			return event.name != "useCard" || event.card.name == "tao";
		},
		async cost(event, trigger, player) {
			if (trigger.name == "useCard") {
				const cards = trigger.cards.filterInD("od");
				event.result = {
					bool: true,
					targets: [trigger.player],
				};
				/*event.result = await player.chooseBool(get.prompt(event.skill, trigger.player), cards.length && trigger.player != player ? `获得${get.translation(cards)}` : "摸两张牌").forResult();
				event.result.targets = [trigger.player];*/
			} else {
				event.result = await player
					.chooseTarget(get.prompt(event.skill), "选择一名筑围角色，其回复体力时取消之，其死亡时你摸三张牌")
					.set("ai", target => {
						return -get.attitude(get.player(), target);
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (trigger.name != "useCard") {
				const name = "qlzhuwei_effect",
					target = event.targets[0];
				player.markAuto(name, target);
				player.addTempSkill(name, { global: "roundStart" });
				return;
			}
			const cards = trigger.cards.filterInD("od");
			if (cards.length && trigger.player != player) {
				await player.gain(cards, "gain2");
			} else {
				await player.draw(2);
			}
			const result = await player
				.chooseBool(`是否取消${get.translation(trigger.card)}的全部目标？`)
				.set(
					"choice",
					(() => {
						if (!trigger.targets?.length) {
							return true;
						}
						return (
							trigger.targets.reduce((sum, target) => {
								return sum + get.effect(target, trigger.card, trigger.player, player);
							}, 0) <= 0
						);
					})()
				)
				.forResult();
			if (result?.bool) {
				trigger.targets.length = 0;
				trigger.all_excluded = true;
			} else {
				return;
			}
			const target = event.targets[0];
			const list = get.inpileVCardList(info => {
				if (!["sha", "juedou"].includes(info[2])) {
					return false;
				}
				const card = new lib.element.VCard({ name: info[2], nature: info[3], isCard: true });
				return player.canUse(card, target, false);
			});
			if (!list.length) {
				return;
			}
			const result2 = await player
				.chooseButton([`选择要对${get.translation(target)}使用的牌`, [list, "vcard"]], true)
				.set("ai", button => {
					const card = new lib.element.VCard({ name: button.link[2], nature: button.link[3], isCard: true }),
						{ player, target } = get.event();
					return get.effect(target, card, player, player);
				})
				.set("target", target)
				.forResult();
			if (!result2?.bool || !result2.links?.length) {
				return;
			}
			const card = new lib.element.VCard({ name: result2.links[0][2], nature: result2.links[0][3], isCard: true });
			if (!player.canUse(card, target, false)) {
				return;
			}
			const next = player.useCard(card, target, false);
			await next;
			if (player.hasHistory("sourceDamage", evt => evt.getParent(next.name) == next && evt.card == next.card)) {
				const name = "qlzhuwei_sha";
				player.addTempSkill(name, { player: "phaseEnd" });
				player.addMark(name, 1, false);
			} else {
				player.tempBanSkill(event.name);
			}
		},
		subSkill: {
			sha: {
				charlotte: true,
				onremove: true,
				intro: {
					content(storage, player) {
						return `出杀次数${storage >= 0 ? "+" : ""}${storage}`;
					},
				},
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("qlzhuwei_sha");
						}
					},
				},
			},
			effect: {
				audio: "qlzhuwei",
				init(player, skill) {
					player.addTip(skill, `筑围 ${get.translation(player.getStorage(skill))}`);
				},
				onremove(player, skill) {
					player.removeTip(skill);
					player.setStorage(skill, null);
				},
				charlotte: true,
				trigger: {
					global: ["recoverBegin", "die"],
				},
				filter(event, player) {
					return player.getStorage("qlzhuwei_effect").includes(event.player);
				},
				forced: true,
				locked: false,
				logTarget: "player",
				async content(event, trigger, player) {
					if (trigger.name == "die") {
						await player.draw(3);
					} else {
						trigger.cancel();
					}
				},
			},
		},
	},
	qlkeshou: {
		audio: "drlt_qianjie",
		trigger: {
			player: ["damageBegin4", "phaseBegin"],
			global: "phaseEnd",
		},
		filter(event, player, name) {
			if (name == "phaseEnd") {
				return player.getHistory("skipped").length > 0;
			}
			let num = player.getCardUsable("sha", true);
			const evt = get.event().getParent("phaseUse", true, true);
			if (evt) {
				const used = player.getHistory("useCard", evtx => {
					return evtx.getParent("phaseUse") == evt && evtx.card.name == "sha" && evtx.addCount !== false;
				}).length;
				num -= used;
			}
			num = Math.max(0, num);
			if (event.name == "phase") {
				return num == 0;
			}
			return num > 0 && player.countDiscardableCards(player, "he");
		},
		async cost(event, trigger, player) {
			if (event.triggername == "phaseBegin") {
				event.result = await player.chooseBool(get.prompt(event.skill), "跳过本回合出牌阶段和弃牌阶段").forResult();
				return;
			}
			if (trigger.name == "phase") {
				const list = get.inpileVCardList(info => {
					if (info[0] != "trick") {
						return false;
					}
					const card = new lib.element.VCard({ name: info[2], isCard: true });
					return player.hasUseTarget(card);
				});
				if (!list.length) {
					return;
				}
				const result = await player
					.chooseButton(["恪守：视为使用一张普通锦囊牌", [list, "vcard"]], true)
					.set("ai", button => {
						const card = new lib.element.VCard({ name: button.link[2], isCard: true }),
							player = get.player();
						return player.getUseValue(card);
					})
					.forResult();
				if (result?.bool && result.links?.length) {
					event.result = {
						bool: true,
						cost_data: result.links[0][2],
					};
				}
				return;
			}
			event.result = await player
				.chooseToDiscard(get.prompt(event.skill), "弃置一张牌并令出杀次数-1，然后防止此伤害", "he")
				.set("selectCard", game.openZhizhi() ? [1, Infinity] : 1)
				.set("chooseonly", true)
				.set("eff", get.damageEffect(player, trigger.source || player, player))
				.set("ai", card => {
					const { eff } = get.event();
					if (eff >= 0) {
						return 0;
					}
					return 6 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			if (event.triggername == "phaseBegin") {
				for (let i = 0; i < trigger.phaseList.length; i++) {
					let phase = trigger.phaseList[i];
					for (const name of ["phaseUse", "phaseDiscard"]) {
						if (phase.startsWith(name)) {
							trigger.phaseList[i] = phase.replace(name, `skip${name.slice(5)}-${event.name}`);
						}
					}
				}
				return;
			}
			if (trigger.name == "phase") {
				const name = event.cost_data,
					card = new lib.element.VCard({ name, isCard: true });
				if (player.hasUseTarget(card)) {
					await player.chooseUseTarget(card, false, true);
				}
				return;
			}
			await player.modedDiscard(event.cards);
			trigger.cancel();
			const name = "qlzhuwei_sha";
			player.addTempSkill(name, { player: "phaseEnd" });
			player.addMark(name, -1, false);
		},
	},
	qljuejie: {
		audio: "drlt_poshi",
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return false;
			}
			if (player == _status.currentPhase) {
				return false;
			}
			return event.getl(player)?.cards2?.length;
		},
		forced: true,
		async content(event, trigger, player) {
			await player
				.judge(card => {
					const color = get.color(card);
					if (color == "red") {
						return 1;
					}
					if (color == "black") {
						return 0.5;
					}
					return 0.1;
				})
				.set("callback", async (event, trigger, player) => {
					const { result } = event.getParent();
					if (result.color == "red") {
						const trigger = event.getTrigger();
						await player.draw(game.openZhizhi() ? trigger.getl(player).cards2.length : 1);
					}
					if (result.color == "black") {
						const trigger = event.getTrigger();
						const colors = trigger
							.getl(player)
							.cards2.map(card => get.color(card))
							.toUniqued();
						if (colors.length) {
							const result2 = await player
								.chooseTarget(`是否令一名角色不能使用或打出颜色为${get.translation(colors)}的牌？`)
								.set("ai", target => {
									return -get.attitude(get.player(), target);
								})
								.forResult();
							if (result2?.bool && result2.targets?.length) {
								const target = result2.targets[0],
									skill = "qljuejie_guanjue";
								player.line(target);
								target.addTempSkill(skill);
								target.markAuto(skill, colors);
							}
						}
					}
				});
		},
		subSkill: {
			guanjue: {
				charlotte: true,
				mark: true,
				onremove: true,
				mod: {
					cardEnabled(card, player) {
						const color = get.color(card),
							list = player.getStorage("qljuejie_guanjue");
						if (color != "unsure" && list.includes(color)) {
							return false;
						}
					},
					cardRespondable(card, player) {
						const color = get.color(card),
							list = player.getStorage("qljuejie_guanjue");
						if (color != "unsure" && list.includes(color)) {
							return false;
						}
					},
					cardSavable(card, player) {
						const color = get.color(card),
							list = player.getStorage("qljuejie_guanjue");
						if (color != "unsure" && list.includes(color)) {
							return false;
						}
					},
				},
				intro: {
					content: "不能使用或打出$牌",
				},
			},
		},
	},
	qlpingwen: {
		trigger: {
			global: ["roundStart", "phaseOver"],
		},
		forced: true,
		intro: {
			content: `$的额定回合开始前，其代替你执行你的额定回合`,
		},
		filter(event, player, name) {
			if (name == "roundStart") {
				return game.hasPlayer(current => current != player);
			}
			const target = (current => {
				let players = game.players
					.slice(0)
					.concat(game.dead)
					.sort((a, b) => parseInt(a.dataset.position) - parseInt(b.dataset.position));
				let position = parseInt(current.dataset.position);
				for (let i = 0; i < players.length; i++) {
					if (parseInt(players[i].dataset.position) > position) {
						return players[i];
					}
				}
				return players[0];
			})(event.player),
				list = player.getStorage("qlpingwen");
			if (!target?.isIn()) {
				return false;
			}
			if (target == player) {
				if (player.hasSkill("qlpingwen_phase")) {
					return true;
				}
				return list.length && list.some(current => current?.isIn());
			}
			return list.includes(target);
		},
		async content(event, trigger, player) {
			if (event.triggername == "roundStart") {
				const result = await player
					.chooseTarget("平纹：令一名其他角色代替你执行额定回合", true, lib.filter.notMe)
					.set("ai", target => {
						return get.attitude(get.player(), target);
					})
					.forResult();
				if (result?.bool && result.targets?.length) {
					player.line(result.targets);
					player.addTempSkill("qlyinye", { global: "roundEnd" });
					player.setStorage(event.name, result.targets, true);
					const target = result.targets[0];
					if (trigger.player == target) {
						const next = target.insertPhase();
						next.isFromPingwen = true;
						delete next.skill;
						if (!trigger._finished) {
							trigger.finish();
							trigger._finished = true;
							trigger.untrigger(true);
							trigger._triggered = 5;
							if (!lib.onround.includes(lib.skill.qlpingwen.onRound)) {
								lib.onround.push(lib.skill.qlpingwen.onRound);
							}
							const evt = trigger.player.insertPhase();
							evt.set("qlpingwen", true);
							evt.relatedEvent = trigger.relatedEvent || trigger.getParent(2);
							evt.skill = trigger.skill;
							evt._noTurnOver = true;
							evt.set("phaseList", trigger.phaseList);
							evt.pushHandler("qlpingwen", (event, option) => {
								if (event.step === 0 && option.state === "begin") {
									event.step = 4;
									_status.globalHistory.push({
										cardMove: [],
										custom: [],
										useCard: [],
										changeHp: [],
										everything: [],
									});
									let players = game.players.slice(0).concat(game.dead);
									for (let i = 0; i < players.length; i++) {
										let current = players[i];
										current.actionHistory.push({
											useCard: [],
											respond: [],
											skipped: [],
											lose: [],
											gain: [],
											sourceDamage: [],
											damage: [],
											custom: [],
											useSkill: [],
										});
										current.stat.push({ card: {}, skill: {} });
									}
								}
							});
						}
					}
					if (trigger.player == player) {
						trigger.cancel();
					}
				}
				return;
			}
			const target = (current => {
				let players = game.players
					.slice(0)
					.concat(game.dead)
					.sort((a, b) => parseInt(a.dataset.position) - parseInt(b.dataset.position));
				let position = parseInt(current.dataset.position);
				for (let i = 0; i < players.length; i++) {
					if (parseInt(players[i].dataset.position) > position) {
						return players[i];
					}
				}
				return players[0];
			})(trigger.player);
			if (target == player) {
				if (game.players.includes(target)) {
					lib.onphase.forEach(i => i());
					const phase = target.phase();
					event.next.remove(phase);
					let isRoundEnd = false;
					if (lib.onround.every(i => i(phase, target))) {
						isRoundEnd = _status.roundSkipped;
						if (_status.isRoundFilter) {
							isRoundEnd = _status.isRoundFilter(phase, target);
						} else if (_status.seatNumSettled) {
							const seatNum = target.getSeatNum();
							if (seatNum != 0) {
								if (get.itemtype(_status.lastPhasedPlayer) != "player" || seatNum < _status.lastPhasedPlayer.getSeatNum()) {
									isRoundEnd = true;
								}
							}
						} else if (target == _status.roundStart) {
							isRoundEnd = true;
						}
						if (isRoundEnd && _status.globalHistory.some(i => i.isRound)) {
							game.log();
							await event.trigger("roundEnd");
						}
					}
					phase.cancel();
				}
				trigger.player = target;
				const targetx = (current => {
					let players = game.players
						.slice(0)
						.concat(game.dead)
						.sort((a, b) => parseInt(a.dataset.position) - parseInt(b.dataset.position));
					let position = parseInt(current.dataset.position);
					for (let i = 0; i < players.length; i++) {
						if (parseInt(players[i].dataset.position) > position) {
							return players[i];
						}
					}
					return players[0];
				})(trigger.player);
				if (player.getStorage(event.name).includes(targetx)) {
					if (!lib.onround.includes(lib.skill.qlpingwen.onRound)) {
						lib.onround.push(lib.skill.qlpingwen.onRound);
					}
					player.addTempSkill("qlpingwen_phase", { global: "roundStart" });
					const next = targetx.insertPhase();
					next.isFromPingwen = true;
					delete next.skill;
				}
				//_status.lastPhasedPlayer = target;
			} else {
				if (!lib.onround.includes(lib.skill.qlpingwen.onRound)) {
					lib.onround.push(lib.skill.qlpingwen.onRound);
				}
				player.addTempSkill("qlpingwen_phase", { global: "roundStart" });
				const next = target.insertPhase();
				next.isFromPingwen = true;
				delete next.skill;
			}
		},
		onRound(event) {
			return event.isFromPingwen !== true;
		},
		subSkill: {
			phase: {
				charlotte: true,
			},
		},
	},
	qlchousi: {
		trigger: {
			global: "useCardAfter",
		},
		filter(event, player) {
			if (event.player == player || event.swapByBojian) {
				return false;
			}
			const bool1 = player.getStorage("qlchousi", false),
				bool2 = get.tag(event.card, "damage") > 0;
			if (bool1 !== bool2) {
				return false;
			}
			const list = player.getStorage("qlchousi_phase", lib.phaseName);
			return list.length;
		},
		async cost(event, trigger, player) {
			const list = player.getStorage("qlchousi_phase", lib.phaseName).map((name, index) => [index + 1, "", name.split("|")[0]]);
			const result = await player
				.chooseButton([
					trigger == "forced" ? "抽丝：跳过一个阶段" : get.prompt(event.skill),
					[
						list,
						(item, type, position, noclick, node) => {
							let showCard = [item[0], item[1], `lusu_${item[2]}`];
							node = ui.create.buttonPresets.vcard(showCard, type, position, noclick);
							node.node.info.innerHTML = `<span style = "color:#ffffff">${item[0]}</span>`;
							node.node.info.style["font-size"] = "20px";
							node._link = node.link = item;
							node._customintro = uiintro => {
								uiintro.add(get.translation(node._link[2]));
								uiintro.addText(`此阶段为本回合第${get.cnNumber(node._link[0], true)}个阶段`);
								return uiintro;
							};
							return node;
						},
					],
				])
				.set("forced", trigger == "forced")
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			} else {
				event.result = { bool: false };
			}
		},
		async content(event, trigger, player) {
			const list = player.getStorage("qlchousi_phase", lib.phaseName),
				link = event.cost_data;
			player.setStorage(
				"qlchousi_phase",
				list.filter((value, index) => index + 1 !== link[0])
			);
			player.addSkill("qlchousi_phase");
			const result = await player
				.chooseToUse(
					function (card, player, event) {
						if (get.type2(card) != get.event().allowType) {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					`抽丝：使用一张${get.translation(get.type2(trigger.card))}牌，或点取消将手牌摸至与${get.translation(trigger.player)}相同`
				)
				.set("complexSelect", true)
				.set("allowType", get.type2(trigger.card))
				.forResult();
			if (result.bool == false) {
				const num = trigger.player.countCards("h") - player.countCards("h");
				if (num > 0) {
					await player.draw(num);
				}
			}
		},
		subSkill: {
			phase: {
				charlotte: true,
				onremove: true,
				trigger: {
					global: "phaseBefore",
				},
				filter(event, player) {
					if (event.isFromPingwen) {
						return true;
					}
					return event.player == player && lib.onround.every(i => i(event, player));
				},
				logTarget: "player",
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.phaseList = player.getStorage(event.name, lib.phaseName);
					player.removeSkill(event.name);
				},
			},
		},
	},
	qlbojian: {
		trigger: {
			global: "useCardAfter",
		},
		filter(event, player) {
			if (event.player == player || event.swapByBojian) {
				return false;
			}
			if (!player.hasSkill("qlchousi", null, null, false)) {
				return false;
			}
			const bool1 = player.getStorage("qlbojian", false),
				bool2 = get.tag(event.card, "damage") > 0;
			if (bool1 === bool2) {
				return false;
			}
			const list = player.getStorage("qlchousi_phase", lib.phaseName);
			return list.length;
		},
		async content(event, trigger, player) {
			trigger.swapByBojian = true;
			player.setStorage("qlchousi", !player.getStorage("qlchousi", false));
			player.setStorage("qlbojian", !player.getStorage("qlbojian", false));
			await get.info("qlchousi").cost(event, "forced", player);
			if (!event?.result?.bool) {
				return;
			}
			player.logSkill("qlchousi");
			await get.info("qlchousi").content(event.result, trigger, player);
			if (
				game.hasGlobalHistory("changeHp", evt => {
					return evt.num && evt.getParent(event.name, true) == event;
				})
			) {
				return;
			}
			if (!player.hasSkill("qlbojian")) {
				await player.loseHp();
				return;
			}
			const result = await player.chooseBool("失去1点体力，或点取消失去〖剥茧〗").forResult();
			if (result?.bool) {
				await player.loseHp();
			} else {
				await player.removeSkills("qlbojian");
				player.addSkill("qlbojian_phase");
			}
		},
		subSkill: {
			phase: {
				trigger: { global: "roundEnd" },
				forced: true,
				locked: false,
				charlotte: true,
				async content(event, trigger, player) {
					player.insertPhase();
				},
			},
		},
	},
	//秋礼二号
	qllvling: {
		trigger: {
			global: ["useSkill", "logSkillBegin"],
			player: "damageBegin2",
		},
		persevereSkill: true,
		locked: true,
		forced: true,
		filter(event, player) {
			if (event.name == "damage") {
				return !event.card && game.openZhizhi();
			} else {
				if (["global", "equip"].includes(event.type)) {
					return false;
				}
				let skill = get.sourceSkillFor(event);
				if (!skill || skill === "qllvling") {
					return false;
				}
				let info = get.info(skill);
				if (!info || info.charlotte || info.equipSkill) {
					return false;
				}
				if (event.player && event.player.countCards("h") < player.countCards("h")) {
					return false;
				}
				return true;
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				trigger.cancel();
			}
			await player.draw();
		},
		global: "qllvling_use",
		subSkill: {
			use: {
				mod: {
					cardEnabled(card, player, target) {
						if (game.hasPlayer(i => i != player && i.hasSkill("qllvling")) && _status.currentPhase != player) {
							return false;
						}
					},
					cardSavable(card, player, target) {
						if (game.hasPlayer(i => i != player && i.hasSkill("qllvling")) && _status.currentPhase != player && game.openZhizhi()) {
							return false;
						}
					},
				},
			},
		},
	},
	qlmouding: {
		charlotte: true,
		superCharlotte: true,
		fixed: true,
		trigger: {
			global: "gameStart",
			source: "damageSource",
			player: ["damageEnd", "phaseJieshuBegin", "phaseUseBegin"],
		},
		getIndex(event) {
			return event.name == "damage" ? event.num : 1;
		},
		intro: {
			content: "已通过此法获得：$",
		},
		direct: true,
		getMap() {
			if (!_status.qlmouding) {
				_status.qlmouding = {};
				var list = [];

				for (let i in lib.character) {
					if (lib.character[i][3]?.length) list.push(i);
				}

				list.forEach(name => {
					if (name !== "qlgujian") {
						// 排除孤剑
						const skills = get.character(name, 3);

						for (var skill of skills) {
							if (lib.skill[skill]?.derivation?.length) {
								skills.addArray(lib.skill[skill].derivation);
							}
						}

						skills.forEach(skill => {
							const info = get.info(skill);
							if (!info || (info.ai && info.ai.combo)) {
								return;
							}
							if (skill in _status.qlmouding) {
								return;
							}

							const voices = get.Audio.skill({ skill, name }).textList;

							if (
								voices.some(text => {
									const pinyins = get.pinyin(text, false);
									for (let i = 0; i < pinyins.length - 1; i++) {
										if (pinyins[i] === "zhu" && pinyins[i + 1] === "gong") {
											return true;
										}
									}
									return false;
								})
							) {
								_status.qlmouding[skill] = name;
							}
						});
					}
				});
			}
			return _status.qlmouding;
		},
		async content(event, trigger, player) {
			var result = await player.chooseBool(get.prompt(event.name), '随机获得一个台词中包含"主公"的技能').set("ai", () => 1).forResult();

			if (!result?.bool) return;

			player.logSkill(event.name);
			var map = lib.skill.qlmouding.getMap(),
				list = Object.keys(map);
			//game.log(list);
			for (var skill of list) {
				if (!player.getStorage(event.name).every(s => get.translation(skill) !== get.translation(s))) {
					list.removeArray([skill]);
				}
			}

			if (list.length > 0) {
				const num = Math.min(3, list.length);
				const skills = list.randomGets(num);
				const dict = skills.map(skill => get.skillInfoTranslation(skill));
				const result = await player.chooseControl(skills).set("choiceList", dict).forResult();
				if (result.control) {
					player.addSkills(result.control);
					player.markAuto(event.name, [result.control]);
				}
			} else {
				await player.draw(2);
			}
		},
		skill_id: "qlmouding",
	},
	//水晶杯
	qltitou: {
		derivation: ["qlyinye"],
		trigger: { global: "roundStart" },
		filter(event, player) {
			return game.hasPlayer(target => target != player);
		},
		forced: true,
		async content(event, trigger, player) {
			const num = Math.max(1, player.getDamagedHp());
			const result = await player
				.chooseTarget(`剔透：对一名其他角色造成${num}点伤害`, true, lib.filter.notMe)
				.set("ai", target => get.damageEffect(target, get.player(), get.player()))
				.forResult();
			if (result.targets?.length) {
				const [target] = result.targets;
				player.line(target, "yellow");
				await target.damage(num);
				const resultx = await player
					.chooseControl("上家", "下家")
					.set("prompt", `剔透：在${get.translation(target)}的上家或下家召唤一个“水晶杯投影”`)
					.set("chioce", Math.random() > 0.3 ? 0 : 1)
					.forResult();
				if (typeof resultx?.index == "number") {
					await player.loseMaxHp();
					const { index } = resultx;
					await player.ql_addPlayer(target, "ql_touying", null, !!index, { identity: "ql_ying", noCheckResult: true });
					await event.trigger("qltouyingAdd");
				}
			}
		},
		init(player, skill) {
			player.addSkill(skill + "_change");
		},
		onremove(player, skill) {
			player.addSkill(skill + "_change");
		},
		mod: {
			targetInRange(card, player, target) {
				if (game.hasPlayer(i => i.qltitou_source == player && i.inRange(target))) {
					return true;
				}
			},
		},
		group: ["qltitou_die", "qltitou_loseHp", "qltitou_exclude", "qltitou_draw"],
		subSkill: {
			draw: {
				forced: true,
				trigger: { global: "damageSource" },
				filter(event, player) {
					return event.source?.qltitou_source == player;
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
			remove: {
				charlotte: true,
				silent: true,
				trigger: {
					global: ["dieAfter", "roundEnd"],
				},
				filter(event, player) {
					if (event.name == "die") {
						return player.qltitou_source == event.player;
					}
					return true;
				},
				async content(event, trigger, player) {
					if (trigger.name == "die") {
						await player.discard(player.getCards("hesjx"));
						await game.removePlayerOL(player);
					} else {
						await player.die();
					}
				},
				mark: true,
				marktext: "主",
				intro: {
					name: "水晶杯投影",
					content(storage, player, skill) {
						if (!player.qltitou_source) {
							return `无事发生`;
						}
						const me = game.me._trueMe || game.me;
						if (player.qltitou_source == me) {
							return `你是她的主人`;
						} else {
							return `你不是她的主人`;
						}
					},
				},
			},
			change: {
				charlotte: true,
				forced: true,
				popup: false,
				priority: 100,
				trigger: {
					global: ["qltouyingAdd", "dieAfter"],
				},
				filter(event, player) {
					if (event.name == "die") {
						return event.player.qltitou_source == player;
					}
					return event.player == player;
				},
				async content(event, trigger, player) {
					if (game.hasPlayer(i => i.qltitou_source == player)) {
						player.addAdditionalSkill("qltitou", "qlyinye");
					} else {
						player.removeAdditionalSkill("qltitou");
					}
					if (trigger.name == "die") {
						await game.removePlayerOL(trigger.player);
					}
				},
			},
			die: {
				trigger: {
					global: ["dieAfter"],
				},
				filter(event, player) {
					return event.player.qltitou_source == player;
				},
				forced: true,
				priority: 99,
				async content(event, trigger, player) {
					await player.gainMaxHp();
					if (game.openZhizhi()) {
						await player.draw(3);
					}
				},
			},
			loseHp: {
				forced: true,
				trigger: {
					player: ["loseHpBefore", "gainMaxHpBefore", "loseMaxHpBefore"],
				},
				filter(event, player) {
					if (event.name == "loseHp") {
						return game.hasPlayer(i => i.qltitou_source == player);
					}
					return !["qltitou", "qltitou_die"].includes(event.getParent().name);
				},
				async content(event, trigger, player) {
					if (trigger.name == "loseHp") {
						let result;
						game.countPlayer(i => i.qltitou_source == player) == 1
							? (result = { bool: true, targets: game.filterPlayer(i => i.qltitou_source == player) })
							: (result = await player
								.chooseTarget(`剔透：请选择一名水晶杯投影代替你失去${trigger.num}点体力`, true, (card, player, target) => {
									return target.qltitou_source == player;
								})
								.set("ai", target => target.getHp())
								.forResult());
						if (result?.targets?.length) {
							const [target] = result.targets;
							player.line(target, "green");
							trigger.player = target;
							game.log(target, "代替", player, "失去体力");
						}
					} else {
						trigger.cancel();
					}
				},
			},
			exclude: {
				forced: true,
				trigger: {
					target: "useCardToBefore",
				},
				filter(event, player) {
					return event.player != player && get.is.virtualCard(event.card);
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (!card.cards?.length) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
		},
	},
	qltuosha: {
		trigger: {
			player: "phaseBegin",
		},
		filter(event, player) {
			return game.hasPlayer(i => i.qltitou_source == player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return ["getNext", "getPrevious"].some(i => target[i]().qltitou_source == player) && player.canUse(get.card(), target, false, false);
				})
				.set("ai", target => get.effect(target, get.card(), get.player(), get.player()))
				.set("_get_card", get.autoViewAs({ name: "sha", nature: "stab", isCard: true }))
				.forResult();
		},
		async content(event, trigger, player) {
			const card = get.autoViewAs({ name: "sha", nature: "stab", isCard: true });
			await player.useCard(card, event.targets, false).set("oncard", () => {
				get.event().effectCount++;
				if (game.openZhizhi()) {
					get.event().baseDamage++;
				}
			});
		},
		group: ["qltuosha_viewAs"],
		subSkill: {
			viewAs: {
				hiddenCard(player, name) {
					return player.getStorage("qltuosha_used").length < 2 && get.type({ name: name }) == "basic" && lib.inpile.includes(name);
				},
				enable: "chooseToUse",
				filter(event, player) {
					const storage = player.getStorage("qltuosha_used");
					const bool1 = !storage.includes("give") && game.hasPlayer(target => target != player) && player.countCards("h");
					const bool2 = !storage.includes("draw") && game.hasPlayer(target => target != player && target.countCards("h") > player.countCards("h"));
					if (!bool1 && !bool2) {
						return false;
					}
					return get.info("qltuosha_viewAs").getList(event, player).length;
				},
				getList(event, player) {
					return get
						.inpileVCardList(info => info[0] == "basic")
						.concat([["basic", "", "sha", "stab"]])
						.filter(info => event.filterCard(get.autoViewAs({ name: info[2], nature: info[3], isCard: true, storage: { qltuosha: true } }), player, event));
				},
				chooseButton: {
					dialog(event, player) {
						const list = get.info("qltuosha_viewAs").getList(event, player);
						return ui.create.dialog(
							"砣砂",
							[
								[
									["give", "将一种类型的牌交给一名其他角色"],
									["draw", "将手牌摸至一名其他角色相同"],
								],
								"tdnodes",
							],
							[list, "vcard"],
							"hidden"
						);
					},
					select: 2,
					check(button) {
						if (typeof button.link == "string") {
							return Math.random();
						}
						if (get.event().getParent().type != "phase") {
							return 1;
						}
						const player = get.player();
						const card = { name: button.link[2], nature: button.link[3] };
						if (
							game.hasPlayer(current => {
								return player.canUse(card, current) && get.effect(current, card, player, player) > 0;
							})
						) {
							switch (button.link[2]) {
								case "tao":
									return 5;
								case "jiu":
									return 3.01;
								case "sha":
									if (button.link[3] == "fire") {
										return 2.95;
									} else if (button.link[3] == "thunder") {
										return 2.92;
									} else {
										return 2.9;
									}
							}
						}
						return 0;
					},
					filter(button) {
						if (!ui.selected.buttons?.length) {
							return typeof button.link == "string" && !get.player().getStorage("qltuosha_used").includes(button.link);
						}
						return typeof button.link != typeof ui.selected.buttons[0].link;
					},
					backup(links, player) {
						const info = links[1];
						const bool = get.event().filterCard(get.autoViewAs({ name: info[2], nature: info[3], isCard: true }), player, get.event());
						links.push(bool);
						return {
							filterCard: () => false,
							selectCard: -1,
							filterTarget(card, player, target) {
								const { links } = get.info("qltuosha_viewAs_backup");
								const str = links[0];
								if (str == "draw" && target.countCards("h") <= player.countCards("h")) {
									return false;
								}
								const bool = links[2];
								if (!bool) {
									return target.qltitou_source == player;
								}
								return target != player;
							},
							ai1() {
								return false;
							},
							ai2(target) {
								const str = get.info("qltuosha_viewAs_backup").links[0];
								if (str == "draw") {
									return target.countCards("h");
								}
								return get.attitude(get.player(), target);
							},
							ignoreMod: true,
							links: links,
							log: false,
							async precontent(event, trigger, player) {
								const {
									targets: [target],
								} = event.result;
								const { links } = get.info(event.name.slice(4));
								player.logSkill("qltuosha_viewAs", target);
								player.addTempSkill("qltuosha_used");
								player.markAuto("qltuosha_used", links[0]);
								if (links[0] == "give") {
									const result = await player
										.chooseControl(
											player
												.getCards("h")
												.map(i => get.type2(i))
												.unique()
										)
										.set("prompt", `请选择要交给${get.translation(target)}的类型`)
										.forResult();
									if (typeof result?.index == "number") {
										const cards = player.getCards("h", card => get.type2(card) == result.control);
										await player.give(cards, target);
									}
								} else {
									await player.drawTo(target.countCards("h"));
								}
								game.broadcastAll(
									(info, bool) => {
										lib.skill.qltuosha_backup.viewAs = { name: info[2], nature: info[3], isCard: true, storage: { qltuosha: bool } };
									},
									links[1],
									target.qltitou_source == player
								);
								const evt = event.getParent();
								evt.set("_backupevent", "qltuosha_backup");
								evt.set("openskilldialog", `请选择${get.translation(links[1][3])}${get.translation(links[1][2])}的目标`);
								evt.backup("qltuosha_backup");
								evt.set("norestore", true);
								evt.set("addCount", target.qltitou_source != player);
								evt.set("custom", {
									add: {},
									replace: { window() { } },
								});
								evt.goto(0);
							},
						};
					},
					prompt(links, player) {
						if (links[0] == "give") {
							return `请选择要交给牌的角色`;
						}
						return `请选择要摸牌至与其相同的角色`;
					},
				},
				mod: {
					cardUsable(card, player) {
						if (card.storage?.qltuosha) {
							return Infinity;
						}
					},
				},
				ai: {
					order() {
						const player = get.player(),
							event = get.event();
						if (event.filterCard({ name: "jiu" }, player, event) && get.effect(player, { name: "jiu" }) > 0) {
							return get.order({ name: "jiu" }) + 0.1;
						}
						return get.order({ name: "sha" }) + 0.1;
					},
					respondSha: true,
					fireAttack: true,
					respondShan: true,
					skillTagFilter(player, tag, arg) {
						if (arg === "respond" || tag == "fireAttack") {
							return true;
						}
						if (player.countCards("he") < player.countMark("dcshizong") + 1) {
							return false;
						}
						if (tag == "respondSha") {
							return false;
						}
					},
					result: {
						player(player) {
							if (_status.event.dying) {
								return get.attitude(player, _status.event.dying);
							}
							return 1;
						},
					},
				},
			},
			used: {
				charlotte: true,
				onremove: true,
			},
			backup: {
				filterCard: () => false,
				selectCard: -1,
				log: false,
			},
		},
	},
	//水晶杯投影
	qlyingjie: {
		enable: "phaseUse",
		usable(skill, player) {
			if (get.event().name == "chooseToUse" && get.event().type == "phase") {
				return 1;
			}
			return Infinity;
		},
		filterTarget(card, player, target) {
			return get.info("qlyingjie").getTargets(player).includes(target);
		},
		selectTarget: -1,
		multitarget: true,
		multiline: true,
		trigger: {
			global: ["useCardAfter" /*,"phaseJieshuBegin"*/],
		},
		filter(event, player) {
			if (event.name == "useCard" && (event.card.name != "sha" || player.qltitou_source != event.player)) {
				return false;
			}
			/*if (event.name == "phaseJieshuBegin" && (player.qltitou_source != event.player || !game.openZhizhi()){
				return false;
			}*/
			return get.info("qlyingjie").getTargets(player).length;
		},
		getTargets(player) {
			return ["getNext", "getPrevious"].map(i => player[i]()).filter(target => player.canUse(get.autoViewAs({ name: "wanjian", isCard: true }), target, false, false));
		},
		check(event, player) {
			return (
				get
					.info("qlyingjie")
					.getTargets(player)
					.reduce((sum, target) => sum + get.effect(target, { name: "wanjian", isCard: true }, player, player), 0) > 0
			);
		},
		logTarget(event, player) {
			return get.info("qlyingjie").getTargets(player);
		},
		async content(event, trigger, player) {
			const { targets } = event;
			await player.useCard(get.autoViewAs({ name: "wanjian", isCard: true }), targets);
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					const eff = get
						.info("qlyingjie")
						.getTargets(player)
						.reduce((sum, target) => sum + get.effect(target, { name: "wanjian", isCard: true }, player, player), 0);
					return eff > 0 ? 1 : 0;
				},
			},
		},
	},
	qlmanxue: {
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		frequent: true,
		async content(event, trigger, player) {
			const video = await player.chooseBool("是否观看技能动画？").forResult();
			if (video.bool)
				game.broadcastAll(function (player) {
					game.gl_cg("五花米线/video/孤剑凛风出场动画.mp4", "noskip"); //暂停游戏，不能跳过，进行特写
				}, player);
			game.broadcastAll(function (bg) {
				_status.tempBackground = "gujianlinfeng_bg";
				game.updateBackground();
			}, "gujianlinfeng_bg");
			ui.background.setBackgroundImage("extension/五花米线/skin/background/gujianlinfeng_bg.jpg");
		},
	},
	//雪景寒林图
	qlhanshan: {
		enable: ["chooseToUse", "chooseToRespond"],
		filterCard(card, player) {
			const list = player.getStorage("qlhanshan_used");
			const suits = lib.suits.filter(c => !list.includes(c));
			return suits.includes(get.suit(card, player));
		},
		position: "hes",
		viewAs: {
			name: "sha",
			nature: "ice",
			storage: {
				qlhanshan: true,
			},
		},
		popname: true,
		selectCard: 1,
		viewAsFilter(player) {
			const list = player.getStorage("qlhanshan_used");
			const suits = lib.suits.filter(c => !list.includes(c));

			if (!player.hasCard(card => suits.includes(get.suit(card, player)), "hes")) {
				return false;
			}
		},
		check(card) {
			const val = get.value(card);
			return 5 - val;
		},
		precontent() {
			player.addTempSkill("qlhanshan_used");
			player.markAuto("qlhanshan_used", [get.suit(event.getParent().result.cards[0])]);
		},
		mod: {
			targetInRange(card, player) {
				if (card?.storage?.qlhanshan) {
					return true;
				}
			},
		},
		group: ["qlhanshan_turnOver"],
		subSkill: {
			turnOver: {
				trigger: {
					global: ["loseAfter", "loseAsyncAfter"],
				},
				getIndex(event, player) {
					if (event.type != "discard") {
						return [];
					}
					return game
						.filterPlayer(target => {
							return target != player && event.getl?.(target)?.hs?.length && !target.countCards("h");
						})
						.sortBySeat();
				},
				filter(event, player, name, target) {
					return target?.isIn();
				},
				prompt2: "令其翻面",
				check(event, player, name, target) {
					return get.attitude(player, target) < 0 && !target.isTurnedOver();
				},
				logTarget(event, player, name, target) {
					return target;
				},
				async content(event, trigger, player) {
					const { indexedData: target } = event;
					await target.turnOver();
				},
			},
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已转化花色：$",
				},
			},
		},
	},
	qlcangfeng: {
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage) {
				if (game.openHuanzhang()) {
					return `转换技，一名角色的回合开始时，你可以令其失去一点体力或弃置其区域内一张牌，若如此做，其本回合使用的第一张牌不可被响应，且本回合其对失去过牌的角色①使用牌无次数限制②使用杀额外结算一次且回复一点体力、使用伤害牌可以额外指定一个目标。`;
				}
				return `转换技，一名角色的回合开始时，你可以令其失去一点体力或弃置其区域内一张牌，若如此做，其本回合使用的第一张牌不可被响应，且本回合${!storage ? "其对失去过牌的角色①使用牌无次数限制②使用杀额外结算一次且回复一点体力" : "使用伤害牌可以额外指定一个目标"}。`;
			},
		},
		trigger: {
			global: "phaseBegin",
		},
		logTarget: "player",
		async cost(event, trigger, player) {
			const target = trigger.player;
			const list = [`令${get.translation(target)}失去一点体力`, `弃置${get.translation(target)}区域内一张牌`];
			if (!target.countDiscardableCards(player, "hej")) {
				list.remove(list[1]);
			}
			const bool = player.storage[event.skill];
			const att = get.attitude(player, target);
			let choice = list.length;
			if ((!bool || game.openHuanzhang()) && att > 0 && target.hp > 1) {
				choice = 0;
			}
			if (att > 0 && list.length > 1) {
				choice = 1;
			}
			const result = await player.chooseControl("cancel2").set("choiceList", list).set("prompt", get.prompt2(event.skill, target)).set("choice", choice).forResult();
			if (result?.control && result.control !== "cancel2") {
				event.result = {
					bool: true,
					cost_data: result.index,
				};
			}
		},
		async content(event, trigger, player) {
			/*if (trigger.player == player) {
				const video = await player.chooseBool("是否观看技能动画？").forResult();
				if (video.bool)
					game.broadcastAll(function (player) {
						game.gl_cg("五花米线/video/" + player.getName() + ".mp4", "noskip"); //暂停游戏，不能跳过，进行特写
					}, player);
			}*/
			const bool = player.storage[event.name];
			player.changeZhuanhuanji(event.name);
			const index = event.cost_data;
			const [target] = event.targets;
			if (index == 0) {
				await target.loseHp();
			} else {
				await player.discardPlayerCard(target, "hej", true);
			}
			target.addTempSkill(`${event.name}_directHit`);
			if (!bool || game.openHuanzhang()) {
				target.addTempSkill(`${event.name}_yang`);
			}
			if (bool || game.openHuanzhang()) {
				target.addTempSkill(`${event.name}_yin`);
			}
			if (game.openZhizhi()) {
				const card = get.autoViewAs({ name: "sha", nature: "ice", isCard: true });
				if (target.hasUseTarget(card)) {
					await target.chooseUseTarget(card, false);
				}
			}
		},
		subSkill: {
			directHit: {
				forced: true,
				charlotte: true,
				trigger: { player: "useCard" },
				filter(event, player) {
					return player.getHistory("useCard").indexOf(event) == 0;
				},
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.players);
				},
			},
			record: {
				charlotte: true,
				silent: true,
				init(player, skill) {
					player.storage[skill] = game.filterPlayer(target => target.hasHistory("lose"));
				},
				onremove: true,
				trigger: { global: "loseAfter" },
				async content(event, trigger, player) {
					player.setStorage(
						event.name,
						game.filterPlayer(target => target.hasHistory("lose"))
					);
				},
			},
			yang: {
				group: "qlcangfeng_record",
				charlotte: true,
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					return event.card.name == "sha" && event.targets?.some(target => target.hasHistory("lose"));
				},
				async content(event, trigger, player) {
					trigger.effectCount++;
					game.log(trigger.card, "额外结算一次");
					await player.recover();
				},
				mod: {
					cardUsableTarget(card, player, target) {
						if (player.getStorage("qlcangfeng_record").includes(target)) {
							return Infinity;
						}
					},
				},
				mark: true,
				intro: {
					content: "对失去过牌的角色①使用牌无次数限制②使用杀额外结算一次且回复一点体力",
				},
			},
			yin: {
				charlotte: true,
				mark: true,
				intro: {
					content: "使用伤害牌可以额外指定一个目标",
				},
				trigger: { player: "useCard2" },
				filter(event, player) {
					if (get.tag(event.card, "damage") > 0.5) {
						return game.hasPlayer(current => {
							return !event.targets?.includes(current) && lib.filter.targetEnabled2(event.card, event.player, current) && lib.filter.targetInRange(event.card, event.player, current);
						});
					}
					return false;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(`苍峰：你可以为${get.translation(trigger.card)}额外指定一个目标`, (card, player, target) => {
							const trigger = get.event().getTrigger();
							return !trigger.targets?.includes(target) && lib.filter.targetEnabled2(trigger.card, trigger.player, target) && lib.filter.targetInRange(trigger.card, trigger.player, target);
						})
						.set("ai", target => {
							return get.effect(target, get.event().getTrigger().card, get.player(), get.player());
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const { targets } = event;
					game.log(targets, "成为", trigger.card, "的额外目标");
					trigger.targets.addArray(targets);
				},
			},
		},
	},
	qllingling: {
		trigger: {
			global: ["phaseBefore", "phaseJieshuBegin"],
			player: "enterGame",
		},
		forced: true,
		filter(event, player, name) {
			if (name != "phaseJieshuBegin") {
				return game.hasPlayer(current => current != player) && (event.name != "phase" || game.phaseNumber == 0);
			} else {
				return get
					.discarded()
					.filter(c => {
						let evt = game.getGlobalHistory("cardMove", evt => evt?.cards.includes(c)).slice(-1)[0];
						let evtx = evt.getParent();
						if (evtx.name != "orderingDiscard") {
							return false;
						}
						let evt2 = evtx.relatedEvent || evtx.getParent();
						return evt2 && evt2.name == "useCard";
					})
					.map(c => get.suit(c))
					.unique().length;
			}
		},
		async content(event, trigger, player) {
			if (trigger.name != "phaseJieshu") {
				let gains = [];
				while (true) {
					const card = get.cardPile2(card => !gains.map(c => get.suit(c)).includes(get.suit(card)));
					if (card) {
						gains.push(card);
					} else {
						break;
					}
				}
				if (gains.length) {
					await player.gain(gains, "gain2");
				}
			} else {
				let num = get
					.discarded()
					.filter(c => {
						let evt = game.getGlobalHistory("cardMove", evt => evt?.cards.includes(c)).slice(-1)[0];
						let evtx = evt.getParent();
						if (evtx.name != "orderingDiscard") {
							return false;
						}
						let evt2 = evtx.relatedEvent || evtx.getParent();
						return evt2 && evt2.name == "useCard";
					})
					.map(c => get.suit(c))
					.unique().length;
				if (num) await player.draw(num);
				if (num == 4) await player.gainMaxHp();
			}
		},
		_priority: 0,
		skill_id: "qllingling",
	},
	ql_longyin: {
		trigger: {
			player: ["useCard", "damageEnd"],
			global: "damageBegin3",
		},
		fristDo: true,
		filter(event, player, name) {
			if (name == "useCard") {
				return event.card.name == "sha" && player.hp > player.getDamagedHp();
			}
			if (name == "damageEnd") {
				if (!event.source?.isIn() || event.source == player || event.num <= 0) {
					return false;
				}
				return game.openZhizhi() || player.hp <= player.getDamagedHp();
			}
			if (event.source == player) {
				return true;
			}
			if (!game.openHuanzhang()) {
				return false;
			}
			return event.player == player && event.num > Math.floor(player.maxHp / 2);
		},
		forced: true,
		async content(event, trigger, player) {
			switch (event.triggername) {
				case "useCard": {
					await player.loseHp();
					return;
				}
				case "damageEnd": {
					if (trigger.source?.isIn()) {
						player.line(trigger.source);
						await trigger.source.damage(trigger.num, "nocard", player);
					}
					return;
				}
				default: {
					if (trigger.source == player) {
						trigger.num = player.getDamagedHp();
					}
					if (game.openHuanzhang() && trigger.player == player) {
						trigger.num = Math.min(trigger.num, Math.floor(player.maxHp / 2));
					}
					return;
				}
			}
		},
		_priority: 100,
	},
	ql_fengming: {
		trigger: {
			player: "useCard",
			target: "useCardToTarget",
		},
		filter(event, player) {
			const list = player.getStorage("ql_fengming_used"),
				num = player.getDamagedHp();
			if (get.color(event.card) != "black" || num <= 0) {
				return false;
			}
			if (!game.openZhizhi() && event.name != "useCard") {
				return false;
			}
			if (!list.includes("draw") && player.countCards("h") < num) {
				return true;
			}
			return !list.includes("recast") && player.countCards("he", lib.filter.cardRecastable) >= 0;
		},
		async cost(event, trigger, player) {
			const num = player.getDamagedHp();
			const result = await player
				.chooseButton([
					get.prompt(event.skill),
					[
						[
							["draw", `摸至${get.cnNumber(num)}张牌`],
							["recast", `重铸至多${get.cnNumber(num)}张牌`],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					const player = get.player(),
						list = player.getStorage("ql_fengming_used"),
						num = player.getDamagedHp();
					if (list.includes(button.link)) {
						return false;
					}
					if (button.link == "draw") {
						return player.countCards("h") < num;
					}
					return player.countCards("he", lib.filter.cardRecastable) >= 0;
				})
				.set("ai", () => Math.random())
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		async content(event, trigger, player) {
			const { cost_data: link } = event,
				skill = "ql_fengming_used";
			player.addTempSkill(skill, { global: ["phaseAnyAfter", "phaseUseAfter"] });
			player.markAuto(skill, link);
			const { skill: name } = player
				.when({
					player: "useCard",
				})
				.assign({
					mod: {
						cardUsable: () => Infinity,
						targetInRange: () => true,
					},
				})
				.step(async (event, trigger, player) => {
					trigger.directHit.addArray(game.players);
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] === "number" && stat[name] > 0) {
							stat[name]--;
						}
						game.log(trigger.card, "不计入次数");
					}
				});
			game.broadcast(name => {
				lib.skill[name].mod = {
					cardUsable: () => Infinity,
					targetInRange: () => true,
				};
			}, name);
			const num = player.getDamagedHp();
			if (link == "draw") {
				if (player.countCards("h") < num) {
					await player.drawTo(num);
				}
			} else {
				if (player.countCards("he", lib.filter.cardRecastable) >= 0) {
					const result = await player
						.chooseCard("he", [0, num], lib.filter.cardRecastable)
						.set("ai", card => {
							return 7 - get.value(card);
						})
						.forResult();
					if (result?.bool && result.cards?.length) {
						await player.recast(result.cards);
					}
				}
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	ql_lijie: {
		trigger: {
			player: "dieBegin",
		},
		filter(event, player) {
			return event.getParent().name != "giveup" && player.maxHp > 0;
		},
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			trigger.cancel();
			player.addSkill("ql_lijie_nodie");
			const phases = [];
			const { reason } = trigger;
			player
				.when({ player: "phaseEnd" })
				.filter((evt, player) => {
					phases.add(evt);
					return phases.length >= 2;
				})
				.step(async (event, trigger, player) => {
					player.removeSkill("ql_lijie_nodie");
					if (player.getHp() < 2) {
						await player.recoverTo(2);
					}
					if (player.hp <= 0) {
						_status.dying.remove(player);
						await player.dying(reason);
					}
				});
			if (game.openZhizhi() && !player.isDisabledJudge()) {
				await player.disableJudge();
			}
		},
		subSkill: {
			nodie: {
				trigger: {
					player: ["dying", "dieBegin"],
					source: "damageBefore",
				},
				charlotte: true,
				forced: true,
				locked: false,
				filter(event, player) {
					if (event.name != "die") {
						return event.name == "dying" || game.openHuanzhang();
					}
					return event.getParent().name != "giveup" && player.maxHp > 0;
				},
				async content(event, trigger, player) {
					if (trigger.name == "damage") {
						await player.gainMaxHp();
						return;
					}
					trigger.cancel();
				},
			},
		},
	},
	//李严
	qlhuaizhi: {
		enable: "phaseUse",
		filterCard(card, player) {
			lib.types = ["basic", "trick", "equip"];
			const list = player.getStorage("qlhuaizhi_used");
			const types = lib.types.filter(c => !list.includes(c));
			const type = get.type2(card, player);
			return types.includes(type);
		},
		position: "hes",
		selectCard: 1,
		async content(event, trigger, player) {
			const { cards } = event;
			const judgeEvent = await player.judge().forResult();
			const suit = judgeEvent.suit;
			const type = get.type2(cards[0]);
			if (suit == "diamond") {
				await player.draw();
			} else {
				switch (type) {
					case "basic":
						const card = "jiu";
						await player.chooseUseTarget(
							{
								name: "jiu",
							},
							false
						);
						await player.chooseUseTarget(
							{
								name: "jiu",
							},
							false
						);
						break;
					case "trick":
						const list = ["摸两张牌", "弃置一名角色两张牌"];
						const result1 = await player
							.chooseButtonTarget({
								createDialog: [
									`###令一名角色执行一项###`,
									[
										[
											["draw", "摸两张牌"],
											["discard", "弃置其两张牌"],
										],
										"textbutton",
									],
								],
								complexSelect: true,
								filterButton(button) {
									if (
										button.link == "discard" &&
										!game.hasPlayer(current => {
											return current.countCards("he") >= 2;
										})
									) {
										return false;
									}
									return true;
								},
								filterTarget(card, player, target) {
									return true;
								},
							})
							.forResult();
						if (result1.links == "draw") {
							await result1.targets[0].draw(2);
						} else {
							await player.discardPlayerCard(result1.targets[0], 2, true, "he", "选择两张牌弃置");
						}
						break;
					case "equip":
						const result2 = await player.chooseTarget().forResult();
						if (result2.bool) {
							const target = result2.targets[0];
							await target.recover();
							if (target.hasUseTarget(cards[0])) {
								await target.chooseUseTarget(cards[0], true);
							}
						}
						break;
				}
			}
			player.markAuto("qlhuaizhi_used", [type]);
			player.addTempSkill("qlhuaizhi_used");
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				sub: true,
				sourceSkill: "qljuezhan",
				_priority: 0,
			},
		},
	},
	//王濬
	qlyinlian: {
		trigger: {
			player: "phaseBegin",
		},
		async cost(event, trigger, player) {
			const choices = [`摸两张牌，然后本回合不能使用【杀】`, `摸一张牌并横置一名角色，然后本回合黑色【杀】均视为雷【杀】`];
			let result = await player.chooseControl().set("choiceList", choices).forResult();
			if (typeof result?.index == "number") {
				event.result = { bool: true, cost_data: result.index };
			}
		},
		async content(event, trigger, player) {
			const { cost_data: index } = event;
			if (index == 0) {
				await player.draw(2);
				await player.addTempSkill(event.name + "_ban");
			}
			if (index == 1) {
				await player.draw();
				const result = await player
					.chooseTarget(`引链：请选择要横置的角色`, (card, player, target) => {
						return true;
					})
					.forResult();
				if (result?.targets?.length) {
					const [target] = result.targets;
					player.line(target);
					await target.link(true);
				}
				player.addTempSkill(event.name + "_thunder");
			}
		},
		subSkill: {
			ban: {
				charlotte: true,
				mod: {
					cardEnabled(card) {
						if (card.name == "sha") {
							return false;
						}
					},
				},
			},
			thunder: {
				charlotte: true,
				mod: {
					cardnature(card, player) {
						if (get.color(card) == "black" && card.name == "sha") {
							return "thunder";
						}
					},
				},
			},
		},
	},
	qlpozhou: {
		enable: "phaseUse",
		filterCard: true,
		position: "he",
		selectCard: 2,
		allowChooseAll: true,
		discard: true,
		lose: true,
		delay: 0,
		filter(event, player) {
			return !player.hasSkill("qlpozhou_ban");
		},
		async content(event, trigger, player) {
			const choices = [];
			const choiceList = ["移动场上一张牌", "摸一张牌且本回合可额外使用一张【杀】", "背水！你的下一张【杀】伤害+1然后本回合不能发动该技能"];
			if (player.canMoveCard()) choices.push("选项一");
			else choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "(无目标牌)</span>";
			if (game.players.length) choices.push("选项二");
			else choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			if (player.canMoveCard()) choices.push("背水！");
			else choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "(无目标牌)</span>";
			const result = await player.chooseControl(choices, "cancel2").set("choiceList", choiceList).forResult();
			game.log(result.index);
			if (result.control == "选项一" || result.control == "背水！") {
				await player.moveCard(true);
			}
			if (result.control == "选项二" || result.control == "背水！") {
				await player.draw();
				player.addTempSkill(event.name + "_more");
				player.addMark(event.name + "_more", 1, false);
			}
			if (result.control == "背水！") {
				player.addTempSkill(event.name + "_ban");
				player.addTempSkill(event.name + "_jia");
			}
		},
		subSkill: {
			more: {
				charlotte: true,
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("qlpozhou_more");
						}
					},
				},
			},
			jia: {
				charlotte: true,
				trigger: {
					player: "useCard1",
				},
				firstDo: true,
				forced: true,
				popup: false,
				onremove: true,
				filter(event, player) {
					return event.card.name == "sha";
				},
				content() {
					trigger.baseDamage += 1;
					player.removeSkill("event.name");
				},
				mark: true,
				marktext: "加",
				intro: {
					content: "下一张【杀】的伤害+1",
				},
				_priority: 3,
			},
		},
	},
	//利簋
	qlyuanfang: {
		trigger: { player: "damageEnd" },
		getIndex: event => event.num,
		async cost(event, trigger, player) {
			const choices = [`摸两张牌`, `获得一名角色一张牌`];
			let result;
			if (!game.hasPlayer(target => target.countGainableCards(player, "he"))) {
				result: {
					index: 1;
				}
			} else {
				result = await player
					.chooseControl()
					.set("choiceList", choices)
					.set("choice", get.effect(player, { name: "wuzhong" }, player, player) > Math.max(...game.players.map(target => get.effect(target, { name: "shunshou_copy2" }, player, player))) ? 0 : 1)
					.forResult();
			}
			if (typeof result?.index == "number") {
				event.result = { bool: true, cost_data: result.index };
			}
		},
		async content(event, trigger, player) {
			if (game.openZhizhi()) {
				player.addTempSkill(`${event.name}_buff`);
			}
			const { cost_data: index } = event;
			if (index == 0) {
				await player.draw(2);
			}
			if (index == 1 && game.hasPlayer(target => target.countGainableCards(player, "he"))) {
				const result = await player
					.chooseTarget(`圆方：请选择要获得牌的角色`, true, (card, player, target) => {
						return target.countGainableCards(player, "he");
					})
					.set("ai", target => get.effect(target, { name: "shunshou_copy2" }, get.player(), get.player()))
					.forResult();
				if (result?.targets?.length) {
					const [target] = result.targets;
					player.line(target);
					await player.gainPlayerCard(target, "he", true);
				}
			}
			if (
				player
					.getRoundHistory("useSkill", evt => evt.skill == event.name)
					.map(evt => evt.event)
					.indexOf(event.getParent()) == 0
			) {
				await player.gainMaxHp(trigger.num);
				await player.recover(trigger.num);
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						let num = 1;
						if (target.hp > 1 && !target.getRoundHistory("useSkill", evt => evt.skill == "qlyuanfang").length) {
							return [1, num * 3];
						}
						if (get.attitude(player, target) > 0) {
							if (player.needsToDiscard()) {
								num = 0.7;
							} else {
								num = 0.5;
							}
						}
						if (target.hp >= 4) {
							return [1, num * 2];
						}
						if (target.hp == 3) {
							return [1, num * 1.5];
						}
						if (target.hp == 2) {
							return [1, num * 0.5];
						}
					}
				},
			},
			threaten: 0.6,
		},
		subSkill: {
			buff: {
				charlotte: true,
				forced: true,
				trigger: { player: "damageBegin3" },
				filter(event, player) {
					return event.num > 0;
				},
				async content(event, trigger, player) {
					trigger.num--;
				},
			},
		},
	},
	qlbaoshang: {
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		position: "he",
		selectCard: 4,
		allowChooseAll: true,
		discard: false,
		lose: false,
		delay: 0,
		filterTarget(card, player, target) {
			return player != target;
		},
		check(card) {
			if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
				return 0;
			}
			const player = get.owner(card);
			const players = game.filterPlayer();
			for (let i = 0; i < players.length; i++) {
				if (!players[i].isTurnedOver() && !players[i].hasJudge("lebu") && get.attitude(player, players[i]) >= 3 && get.attitude(players[i], player) >= 3) {
					return 11 - get.value(card);
				}
			}
			return 10 - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.loseMaxHp();
			await player.give(cards, target);
			const evt = event.getParent("phaseUse", true);
			if (evt?.player == player) {
				evt.skipped = true;
			}
			//event.getParent("phaseUse").skipped = true;
			const next = target.insertPhase();
			target
				.when("phaseBeginStart")
				.filter(evt => evt == next)
				.step(async (event, trigger, player) => {
					player.addTempSkill("qlbaoshang_usable");
					if (game.openZhizhi()) {
						player.addTempSkill("qlbaoshang_damage");
					}
				});
			if (game.openZhizhi()) {
				player
					.when({ global: "phaseBeginStart" })
					.filter(evt => evt == next)
					.step(async (event, trigger, player) => {
						player.addTempSkill("qlbaoshang_effect");
					});
			}
		},
		ai: {
			order(skill, player) {
				if (player.maxHp > 3 && player.hasFriend()) {
					//player.isDamaged() &&
					if (player.countCards("h") == 4) {
						return 10;
					}
					if (player.countCards("h") > 4 && !player.hasCard(card => player.hasValueTarget(card), "h")) {
						return 8;
					}
					return 5;
				}
				return 0;
			},
			result: {
				target(player, target) {
					if (target.hasSkillTag("nogain")) {
						return 0;
					}
					if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
						return target.hasSkillTag("nodu") ? 0 : -10;
					}
					if (target.hasJudge("lebu")) {
						return 0;
					}
					return target.countCards("hs");
				},
			},
			threaten: 0.8,
		},
		subSkill: {
			usable: {
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						return Infinity;
					},
				},
			},
			damage: {
				charlotte: true,
				forced: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return game.getGlobalHistory("everything", evt => evt.name == "damage" && evt.source == player).indexOf(event) == 0;
				},
				async content(event, trigger, player) {
					trigger.num++;
				},
			},
			effect: {
				charlotte: true,
				forced: true,
				trigger: { global: "dieAfter" },
				filter(event, player) {
					return event.source == _status.currentPhase;
				},
				logTarget: () => _status.currentPhase,
				async content(event, trigger, player) {
					const [target] = event.targets;
					await player.gainMaxHp();
					await player.draw(3);
					const result = await player
						.chooseCard(get.prompt2("qlbaoshang", target), 4)
						.set("target", target)
						.set("ai", card => {
							const player = get.player();
							if (get.effect(get.event().target, "qlbaoshang", player, player) > 0) {
								return lib.skill.qlbaoshang.check(card);
							}
							return 0;
						})
						.forResult();
					if (result?.bool && result.cards?.length) {
						await player.useSkill("qlbaoshang", result.cards, [target]);
					}
				},
			},
		},
	},
	qlcaishi: {
		trigger: {
			global: "phaseJieshuBegin",
		},
		async content(event, trigger, player) {
			var num = 0;
			if (trigger.player.countCards("h") == player.countCards("h")) {
				num++;
			}
			if (trigger.player.countCards("e") == player.countCards("e")) {
				num++;
			}
			if (trigger.player.countCards("j") == player.countCards("j")) {
				num++;
			}
			if (num > 0) {
				await game.asyncDraw([trigger.player, player], num);
			} else {
				await player.moveCard();
			}
		},
	},
	qldongwei: {
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => lib.skill.qldongwei.filterCard(card, player), "h") && player.getHistory("useSkill", evt => evt.skill == "qldongwei").length < 3;
		},
		filterCard: (card, player) => get.name(card) == "sha" && player.canRecast(card),
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			await player.recast(event.cards);
			if (player.getHistory("useSkill", evt => evt.skill == "qldongwei").length == 1) {
				const result1 = await player
					.chooseTarget("令一名角色摸两张牌")
					.set("ai", function (target) {
						return get.attitude(_status.event.player, target);
					})
					.forResult();
				if (result1.bool) {
					await result1.targets[0].draw(2);
				}
			} else if (player.getHistory("useSkill", evt => evt.skill == "qldongwei").length == 2) {
				const result2 = await player
					.chooseTarget("交换两名角色装备区的牌")
					.set("selectTarget", 2)
					.set("filterOk", function (target) {
						return ui.selected.targets[1] != ui.selected.targets[0] && (ui.selected.targets[0].countCards("e") > 0 || ui.selected.targets[1].countCards("e") > 0);
					})
					.forResult();
				if (result2.bool) {
					await result2.targets[0].swapEquip(result2.targets[1]);
				}
			} else {
				const result3 = await player
					.chooseTarget("交换两名角色手牌")
					.set("selectTarget", 2)
					.set("filterOk", function (target) {
						return ui.selected.targets[1] != ui.selected.targets[0] && (ui.selected.targets[0].countCards("h") > 0 || ui.selected.targets[1].countCards("h") > 0);
					})
					.forResult();
				if (result3.bool) {
					await result3.targets[0].swapHandcards(result3.targets[1]);
				}
			}
		},
	},
	qlzhongjian: {
		trigger: {
			player: "recoverAfter",
		},
		//direct:true,
		//silent:true,
		//popup:true,
		filter(event, player) {
			if (!event.source) {
				return false;
			}
			if (player.isDying()) {
				return false;
			}
			return player.hp - event.num <= 0;
		},
		async content(event, trigger, player) {
			const list = lib.skill.qlzhongjian.derivation.filter(skill => !trigger.source.hasSkill(skill, null, false, false));
			if (list.length > 0) {
				const result =
					list.length > 1
						? await player
							.chooseControl(list)
							.set("prompt", "是否令" + get.translation(trigger.source) + "获得一个技能")
							.forResult()
						: { control: list[0] };
				if (result.control) {
					await trigger.source.addSkills(result.control);
				}
			} else {
				await trigger.source.draw(2);
			}
		},
		derivation: ["wusheng", "paoxiao"],
		group: ["buyi", "qlzhongjian_die"],
		subSkill: {
			die: {
				trigger: {
					player: "die",
				},
				forceDie: true,
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget("令一名其他角色回复一点体力并摸场上角色数张牌", function (card, player, target) {
							return player != target;
						})
						.set("forceDie", true)
						.set("ai", function (target) {
							var num = get.attitude(_status.event.player, target);
							if (num > 0) {
								if (target.hp == 1) {
									num += 2;
								}
								if (target.hp < target.maxHp) {
									num += 2;
								}
							}
							return num;
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					await target.recover();
					await target.draw(game.countPlayer() + game.dead.length);
				},
			},
		},
	},
	qlquanan: {
		skillAnimation: true,
		animationColor: "gray",
		limited: true,
		unique: true,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("e") > 0;
		},
		filterTarget(card, player, target) {
			return player != target;
		},
		delay: false,
		async content(event, trigger, player) {
			await player.awakenSkill(event.name);
			var cards = player.getCards("e");
			var target = event.target;
			await player.give(cards, target);
			/*var cardx = cards.filter(function(card){
				return(
					cards.include(card) &&
					get.type(card) == "equip" &&
					event.target.canUse(card,event.target,false)
				);
			})
			for(i=0;i<cards.length;i++){
				await event.target.useCard(false,false,event.target,cards[i]);
			}*/
			target.recoverTo(target.maxHp);
			target.insertPhase();
		},
		mark: true,
		intr: {
			content: "limited",
		},
		init: (player, skill) => (player.storage[skill] = false),
	},
	qlsacreSanction: {
		superCharlotte: true,
		persevereSkill: true,
		nobracket: true,
		trigger: {
			player: ["damageBegin2"],
			//global:["useCard"],
		},
		filter(event, player) {
			return !event.card;
		},
		async content(event, trigger, player) {
			trigger.cancel();
		},
		global: "qlsacreSanction_effect",
		subSkill: {
			effect: {
				mod: {
					cardEnabled2(card, player) {
						if (player != _status.currentPhase && !player.hasSkill("qlsacreSanction")) {
							return false;
						}
					},
				},
				charlotte: true,
			},
		},
	},
	ql_ranji: {
		audio: 2,
		trigger: {
			player: "loseHpAfter",
		},
		getIndex(event) {
			return event.num;
		},
		filter(event, player) {
			if (event.num <= 0) {
				return false;
			}
			return game.hasPlayer(current => current != player);
		},
		locked: true,
		async cost(event, trigger, player) {
			const max = game.openZhizhi() && player.hasSkill("ql_huiguang_awaken") ? game.countPlayer() : 2;
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, max], lib.filter.notMe)
				.set("ai", target => {
					const { player } = get.event();
					let eff = get.effect(target, { name: "losehp" }, player, player);
					if (game.openHuanzhang()) {
						eff += get.effect(target, { name: "draw" }, player, player);
					}
					return eff;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const func = async target => {
				if (target.isDamaged()) {
					await target.recover();
				}
			};
			await game.doAsyncInOrder(event.targets, func);
			if (!game.openHuanzhang()) {
				return;
			}
			await game.asyncDraw([player, ...event.targets]);
			if (!player.hasSkill("ql_huiguang_awaken")) {
				return;
			}
			const daojie = async target => {
				const skills = target.getSkills(null, false, false).filter(skill => {
					let info = get.info(skill);
					if (!info || info.charlotte || !get.is.locked(skill) || get.skillInfoTranslation(skill, target).length == 0) {
						return false;
					}
					return true;
				});
				if (!skills?.length) {
					return;
				}
				const result = await target
					.chooseButton(["燃己：是否失去一个锁定技？", [skills, "skill"]])
					.set("displayIndex", false)
					.set("ai", button => {
						const { link } = button;
						const info = get.info(link);
						if (info?.ai?.neg || info?.ai?.halfneg) {
							return 3;
						}
						return 0;
					})
					.forResult();
				if (result?.bool && result.links?.length) {
					await target.removeSkills(result.links);
				}
			};
			await game.doAsyncInOrder([player, ...event.targets], daojie);
		},
	},
	ql_quan: {
		audio: 2,
		trigger: {
			global: ["gainAfter", "loseAsyncAfter"],
		},
		getIndex(event, player) {
			if (!event.getg || !event.getl) {
				return [];
			}
			return game.filterPlayer(current => {
				return current != player && event.getg(current)?.length;
			});
		},
		filter(event, player, name, target) {
			const cards1 = event.getg(target),
				cards2 = event.getl(player)?.cards2;
			return cards2?.length && cards2.containsSome(...cards1);
		},
		async cost(event, trigger, player) {
			const list = get.inpileVCardList(info => {
				if (info[0] != "trick") {
					return false;
				}
				const vcard = new lib.element.VCard({ name: info[2], isCard: true });
				return player.hasUseTarget(vcard);
			});
			if (!list?.length) {
				return;
			}
			const result = await player
				.chooseButton([get.prompt2(event.skill), [list, "vcard"]])
				.set("ai", button => {
					const player = get.player(),
						link = button.link;
					if (player.hp <= 1) {
						return 0;
					}
					const vcard = new lib.element.VCard({ name: link[2], isCard: true });
					return player.getUseValue(vcard) - Math.sqrt(get.effect(player, { name: "losehp" }, player, player));
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0][2],
				};
			}
		},
		async content(event, trigger, player) {
			const { cost_data: name } = event;
			await player.loseHp();
			const card = new lib.element.VCard({ name, isCard: true });
			if (player.hasUseTarget(card)) {
				await player.chooseUseTarget(card, true);
			}
		},
	},
	ql_yuhui: {
		audio: 2,
		trigger: {
			player: ["phaseDrawBegin2", "phaseDrawEnd"],
		},
		filter(event, player, name) {
			if (name === "phaseDrawEnd" && !player.countCards("he")) {
				return false;
			}
			if (name === "phaseDrawBegin2" && event.numFixed) {
				return false;
			}
			return player.isDamaged() || player.hasSkill("ql_huiguang_awaken") || player.countCards("h", { suit: "heart" });
		},
		locked: true,
		async cost(event, trigger, player) {
			let num = 0;
			if (player.isDamaged()) {
				num++;
			}
			if (player.hasSkill("ql_huiguang_awaken")) {
				num++;
			}
			if (player.countCards("h", { suit: "heart" })) {
				num++;
			}
			if (event.triggername == "phaseDrawEnd") {
				event.result = await player
					.chooseCardTarget({
						prompt: get.prompt(event.skill),
						prompt2: `将至多${get.cnNumber(num)}张牌交给一名其他角色`,
						filterCard: true,
						position: "he",
						selectCard: [1, num],
						filterTarget: lib.filter.notMe,
						ai1(card) {
							const player = get.player(),
								target = game
									.filterPlayer(current => current != player)
									.maxBy(current => {
										let att = get.attitude(player, current);
										if (player.hasSkill("ql_quan")) {
											att = Math.max(0.1, att);
										}
										return att;
									});
							if (get.attitude(player, target) <= 0 && ui.selected.cards.length) {
								return 0;
							}
							return 5 - get.value(card);
						},
						complexCard: true,
						ai2(target) {
							const { player } = get.event();
							let att = get.attitude(player, target);
							if (player.hasSkill("ql_quan")) {
								att = Math.max(0.1, att);
							}
							return att;
						},
					})
					.forResult();
			} else {
				event.result = {
					bool: true,
					cost_data: num,
				};
			}
		},
		async content(event, trigger, player) {
			if (event.triggername == "phaseDrawEnd") {
				const {
					cards,
					targets: [target],
				} = event;
				await player.give(cards, target);
			} else {
				const { cost_data: num } = event;
				trigger.num += num;
			}
		},
		mod: {
			maxHandcard(player, num) {
				if (player.isDamaged()) {
					num++;
				}
				if (player.hasSkill("ql_huiguang_awaken")) {
					num++;
				}
				if (player.countCards("h", { suit: "heart" })) {
					num++;
				}
				return num;
			},
		},
	},
	ql_huiguang: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		trigger: {
			player: "dying",
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			trigger.cancel();
			const phases = [];
			const { reason } = trigger;
			player.addSkill("ql_huiguang_effect");
			player
				.when({ player: "phaseEnd" })
				.filter((evt, player) => {
					phases.add(evt);
					const max = game.openZhizhi() ? 3 : 2;
					return phases.length >= max;
				})
				.step(async (event, trigger, player) => {
					player.removeSkill("ql_huiguang_effect");
					if (player.hp <= 0) {
						_status.dying.remove(player);
						await player.dying(reason);
					}
				});
			player.addSkill("ql_huiguang_awaken");
			const split = game.openHuanzhang() ? 2 : 1;
			let { derivation: skills } = get.info(event.name);
			await player.addSkills(skills.slice(0, split));
		},
		derivation: ["kunfen", "jijiu"],
		subSkill: {
			effect: {
				trigger: {
					player: "dying",
				},
				charlotte: true,
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			awaken: {
				trigger: {
					global: "recoverBegin",
				},
				mark: true,
				marktext: "光",
				intro: {
					content: "已发动过【回光】",
				},
				filter(event, player) {
					return event.player == player || event.source == player;
				},
				forced: true,
				charlotte: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.num++;
				},
			},
		},
	},
	ql_qiaoyi: {
		audio: 2,
		usable(skill, player) {
			return player.getShownCards().length;
		},
		enable: ["chooseToUse"],
		filter(event, player) {
			if (!player.countCards("hse")) {
				return false;
			}
			for (var i of lib.inpile) {
				var type = get.type(i);
				if ((type == "basic" || type == "trick") && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i = 0; i < lib.inpile.length; i++) {
					var name = lib.inpile[i];
					if (name == "sha") {
						if (event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
							list.push(["基本", "", "sha"]);
						}
						for (var nature of lib.inpile_nature) {
							if (event.filterCard(get.autoViewAs({ name, nature }, "unsure"), player, event)) {
								list.push(["基本", "", "sha", nature]);
							}
						}
					} else if (get.type(name) == "trick" && event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
						list.push(["锦囊", "", name]);
					} else if (get.type(name) == "basic" && event.filterCard(get.autoViewAs({ name }, "unsure"), player, event)) {
						list.push(["基本", "", name]);
					}
				}
				return ui.create.dialog("巧艺", [list, "vcard"]);
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				var player = _status.event.player;
				if (["wugu", "zhulu_card", "yiyi", "lulitongxin", "lianjunshengyan", "diaohulishan"].includes(button.link[2])) {
					return 0;
				}
				return player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
				});
			},
			backup(links, player) {
				return {
					filterCard: true,
					popname: true,
					check(card) {
						return 8 - get.value(card);
					},
					position: "hse",
					viewAs: { name: links[0][2], nature: links[0][3] },
				};
			},
			prompt(links, player) {
				return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		hiddenCard(player, name) {
			if (!lib.inpile.includes(name)) {
				return false;
			}
			var type = get.type2(name);
			return (type == "basic" || type == "trick") && player.countCards("she") > 0;
		},
		ai: {
			fireAttack: true,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player) {
				if (!player.countCards("hse")) {
					return false;
				}
			},
			order: 1,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
	},
	ql_pozhu: {
		trigger: { player: "useCard" },
		forced: true,
		filter(event, player) {
			if (get.type(event.card) != "equip") {
				return false;
			}
			const subtype = get.subtype(event.card);
			let equip1 = subtype == "equip1";
			if (equip1) {
				const info = get.info(event.card, false);
				let num = 1;
				if (info && info.distance && typeof info.distance.attackFrom == "number") {
					num -= info.distance.attackFrom;
				}
				if (num <= 0) {
					equip1 = false;
				}
			}
			return !player.hasEmptySlot(subtype) || equip1 || game.hasPlayer(current => current != player && current.countGainableCards(player, "h"));
		},
		async content(event, trigger, player) {
			let subtype = get.subtype(trigger.card);
			if (!player.hasEmptySlot(subtype)) {
				await player.expandEquip(subtype);
			}
			if (subtype == "equip1") {
				const info = get.info(trigger.card, false);
				let num = 1;
				if (info && info.distance && typeof info.distance.attackFrom == "number") {
					num -= info.distance.attackFrom;
				}
				if (num > 0) {
					await player.draw(num);
				}
			} else {
				const targets = game.filterPlayer(current => current != player && current.countGainableCards(player, "h"));
				const result = await player
					.chooseTarget("魄铸：观看一名其他角色的手牌并获得其中一张", true, (card, player, target) => {
						return (get.event().targetsx || []).includes(target);
					})
					.set("targetsx", targets).forResult();
				let target = targets.randomGet();
				if (result && result.targets?.length) {
					target = result.targets[0];
				}
				await player.gainPlayerCard(target, "h", true, "visible");
			}
		},
	},
	ql_jiangxin: {
		enable: "phaseUse",
		trigger: { player: "damageEnd", /*source: "damageEnd"*/ },
		usable(skill, player) {
			if (get.event().name == "chooseToUse") {
				return 1;
			} else {
				//return 1;
				return Infinity;
			}
		},
		filterCard(card, player) {
			return !get.is.shownCard(card);
		},
		position: "h",
		lose: false,
		discard: false,
		async cost(event, trigger, player) {
			if (!trigger || !trigger.name) {
				event.result = { bool: true };
				return;
			}
			event.result = await player.chooseCard(get.prompt2(event.skill), "h", lib.skill[event.skill].filterCard).forResult();
		},
		async content(event, trigger, player) {
			const cards = event.cards,
				suit = get.suit(cards[0]);
			await player.addShownCards(cards, "visible_" + event.name);
			const targets = game.filterPlayer(current => {
				return current.getGainableCards(player, "ej", card => get.suit(card) == suit).length;
			});
			if (targets.length) {
				const result = await player
					.chooseTarget("匠心：获得场上的一张" + get.translation(suit) + "牌", true, (card, player, target) => {
						return (get.event().targetsx || []).includes(target);
					})
					.set("targetsx", targets).forResult();
				let target = targets.randomGet();
				if (result && result.targets?.length) {
					target = result.targets[0];
				}
				const cardsx = target.getGainableCards(player, "ej", card => get.suit(card) == suit);
				await player
					.gainPlayerCard(target, "ej", true)
					.set("filterButton", button => {
						return (get.event().cardsx || []).includes(button.link);
					})
					.set("cardsx", cardsx);
			} else {
				const cardx = get.cardPile(card => get.type(card) == "equip", null, "random");
				if (cardx) {
					await player.gain(cardx, "gain2");
				} else {
					player.chat("居然没有装备牌了！");
				}
			}
		},
	},
	qlyinian: {
		enable: "phaseUse",
		filter(event, player) {
			return player.hasMark("qlyinian_chenzhu") || !player.hasSkill("qlyinian_ban");
		},
		selectTarget() {
			return [0, 1];
		},
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			if (!event.targets.length && !player.hasSkill(event.name + "_ban")) {
				await player.loseHp();
				await player.addMark(event.name + "_chenzhu");
				await player.addTempSkill(event.name + "_ban");
			} else if (event.targets.length && player.hasMark(event.name + "_chenzhu")) {
				await player.removeMark(event.name + "_chenzhu");
				const result = await player.chooseControl().set("choiceList", ["令其入佛", "令其入魔"]).forResult();
				if (result.index == 0) {
					await event.target.addMark(event.name + "_chenzhu");
				} else {
					await event.target.addMark(event.name + "_mozhu");
				}
			} else {
				return;
			}
		},
		group: ["qlyinian_gain", "qlyinian_effect4"],
		global: ["qlyinian_effect1", "qlyinian_effect2", "qlyinian_effect3"],
		subSkill: {
			chenzhu: {
				mark: true,
				marktext: "尘",
				intro: {
					content: "共有#枚尘珠标记",
				},
			},
			mozhu: {
				mark: true,
				marktext: "魔",
				intro: {
					content: "共有#枚魔珠标记",
				},
			},
			effect1: {
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("qlyinian_chenzhu");
					},
				},
				trigger: {
					player: "phaseDrawBegin2",
				},
				forced: true,
				filter(event, player) {
					return !event.numFixed && player.hasMark("qlyinian_chenzhu");
				},
				async content(even, trigger, player) {
					trigger.num++;
				},
			},
			effect2: {
				trigger: {
					player: "damageBegin2",
				},
				forced: true,
				filter(event, player) {
					return player.hasMark("qlyinian_chenzhu");
				},
				async content(event, trigger, player) {
					trigger.cancel();
					if (trigger.cards && trigger.cards.length) {
						await player.removeMark("qlyinian_chenzhu");
						await player.gain(trigger.cards, "gain2");
					}
				},
			},
			effect3: {
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("qlyinian_mozhu");
					},
				},
			},
			effect4: {
				trigger: {
					global: "damageBegin2",
				},
				forced: true,
				filter(event, player) {
					return event.player.hasMark("qlyinian_mozhu");
				},
				async content(event, trigger, player) {
					trigger.num++;
					if (trigger.cards && trigger.cards.length && !trigger.cards.filter(card => card.hasGaintag("qlyinian"))) {
						await player.gain(trigger.cards, "gain2").gaintag.add("qlyinian");
					}
				},
				effect5: {
					trigger: {
						player: "phaseEnd",
					},
					forced: true,
					async content(event, trigger, player) {
						player.storage.qlyinian_effect4 = [];
					},
				},
			},
			gain: {
				trigger: {
					global: ["phaseBefore", "dying"],
					player: "enterGame",
				},
				forced: true,
				locked: false,
				direct: true,
				filter(event, player) {
					if (event.name == "dying") {
						return event.player.hasMark("qlyinian_mozhu");
					} else {
						return event.name != "phase" || game.phaseNumber == 0;
					}
				},
				async content(event, trigger, player) {
					await player.addMark("qlyinian_chenzhu", trigger.name == "dying" ? 1 : 5, true);
				},
			},
		},
	},
	qlmiluan: {
		trigger: {
			global: ["gainAfter", "loseAsyncAfter"],
		},
		//因为有可能有多个人获得了你的牌，比如遗计那种分配牌的，所以要用getIndex逐个计算
		getIndex(event, player) {
			return game.filterPlayer(target => {
				if (target == player) {
					return false;
				}
				//获取目标本次获取的牌，和你本次失去的牌，若其获取的牌包含部分你本次失去的牌，则说明其获得了你的牌
				const gain = event.getg?.(target);
				const lose = event.getl?.(player)?.cards2;
				return gain.some(i => lose.includes(i));
			}).sortBySeat();
		},
		filter(event, player, name, target) {
			return event.getl?.(player)?.cards2?.length > 0;
		},
		logTarget(event, player, name, target) {
			return target;
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			const { targets: [target] } = event;
			if (_status.currentPhase == player) {
				player.addTempSkill(`${event.name}_effect`);
				player.markAuto(`${event.name}_effect`, target);
			}
			else {
				const gain = trigger.getg(target);
				const lose = trigger.getl(player).cards2;
				//每个获得牌的限制次数都不一样，所以storage要用object来存了，记得子技能要先init一下
				player.addTempSkill(`${event.name}_damage`);
				//还有初始化对应角色的数据，别待会对这个undefined操作半天
				player.storage[`${event.name}_damage`][target.playerid] ??= 0;
				player.storage[`${event.name}_damage`][target.playerid] += gain.filter(i => lose.includes(i)).length;
				//markSkill有俩作用，一个是广播，一个是让标记显示出来
				player.markSkill(`${event.name}_damage`);
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "本回合对$使用牌没有次数限制",
				},
				mod: {
					//对某个角色无次数限制要用这个mod
					cardUsableTarget(card, player, target) {
						if (player.getStorage("qlmiluan_effect").includes(target)) {
							return Infinity;
						}
					}
				},
			},
			damage: {
				charlotte: true,
				onremove: true,
				init(player, skill) {
					player.storage[skill] = {};
				},
				intro: {
					content(storage, player, skill) {
						let str = "";
						for (const id in storage) {
							const target = game.playerMap[id] || lib.playerOL[id];
							if (target) {
								str += `<li>${get.translation(target)}：${storage[id]}<br>`;
							}
						}
						return str;
					}
				},
				trigger: {
					player: "damageBegin2",
				},
				filter(event, player) {
					return event.source?.isIn() && player.storage["qlmiluan_damage"]?.[event.source?.playerid] > 0;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(get.prompt(event.skill), "将伤害转移给一名角色", (card, player, target) => {
							return target != get.event().getTrigger().player;
						})
						.set("ai", target => {
							const source = get.event().getTrigger().source;
							const player = get.event().getTrigger().player;
							const nature = get.event().getTrigger().nature;
							return get.damageEffect(target, source, player, nature) - get.damageEffect(player, source, player, nature);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const { source } = trigger;
					const { targets: [target] } = event;
					//发动了要记得先把限制次数更新了，原理差不多
					const storage = player.storage[event.name];
					storage[source.playerid]--;
					player.markSkill(event.name);
					//然后把伤害事件的player改一下
					trigger.player = target;
					game.log(player, "将伤害转移给", target);
				}
			},
		},
	},
	qljichi: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: "roundStart",
		},
		mark: true,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage, player, skill) {
				if (storage) {
					return "每轮开始时，你可以摸两张牌且本轮你无视防具，造成伤害+1。";
				}
				return "每轮开始时，你可以摸两张牌且本轮其他角色不能使用单目标牌指定你为目标，本轮你受到伤害+1，你造成或受到伤害后，本轮删去第一句效果。";
			},
		},
		async content(event, trigger, player) {
			const { name } = event;
			player.changeZhuanhuanji(name);
			const bool = player.getStorage(name, false);
			await player.draw(2);
			if (bool) {
				player.addTempSkill(`${name}_damaged`, { global: "roundStart" });
				player.addTempSkill(`qlyinye`, { global: "roundStart" });
			} else {
				player.addTempSkill(`${name}_damage`, { global: "roundStart" });
			}
		},
		subSkill: {
			damage: {
				trigger: {
					source: "damageBegin1",
				},
				forced: true,
				charlotte: true,
				async content(event, trigger, player) {
					trigger.num++;
				},
				ai: {
					unequip: true,
					unequip_ai: true,
				},
			},
			damaged: {
				trigger: {
					player: ["damageBegin3", "damageEnd"],
					source: "damageSource",
				},
				onremove(player, skill) {
					player.removeSkill("qljichi_delete");
				},
				charlotte: true,
				async cost(event, trigger, player) {
					if (event.triggername == "damageBegin3") {
						event.result = {
							bool: true,
						};
						return;
					}
					const num = game.openZhizhi() ? 2 : 1;
					if (event.triggername == "damageEnd" || player.getRoundHistory("sourceDamage").length >= num) {
						player.addTempSkill("qljichi_delete", { global: "roundStart" });
						player.removeSkill("qlyinye");
					}
				},
				async content(event, trigger, player) {
					trigger.num++;
				},
			},
			delete: {
				charlotte: true,
			},
		},
	},
	qlyinye: {
		//nopop: true,
		mark: true,
		intro: {
			content: "你不能成为其他角色使用牌的唯一目标",
		},
		trigger: {
			global: ["chooseTargetBefore", "chooseToUseBefore", "chooseUseTargetBefore", "chooseCardTargetBefore", "chooseButtonTargetBefore"],
		},
		filter(event, player) {
			if ("_get_card" in event || "card" in event) {
				return true;
			}
			return ["useCard", "chooseToUse", "chooseUseTarget"].some(name => {
				return event.getParent(name, true, true);
			});
		},
		async cost(event, trigger, player) {
			trigger.set("complexTarget", true);
		},
		mod: {
			targetEnabled(card, player, target) {
				if (!card.name || player == target) {
					return;
				}
				const evt = get.event().getParent("useCard", true, true);
				if (evt?.targets?.length) {
					return;
				}
				if (ui?.selected?.targets?.length) {
					return;
				}
				return false;
			},
		},
	},
	qljisha: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			player: "phaseBegin",
		},
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		async cost(event, trigger, player) {
			const max = game.openZhizhi() ? 2 : 1;
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, max], lib.filter.notMe)
				.set("ai", target => {
					const player = get.player(),
						card = new lib.element.VCard({ name: "sha", nature: "stab", isCard: true });
					if (player.canUse(card, target, false)) {
						return get.effect(target, card, player, player);
					}
					return -get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const skill = `${event.name}_discard`;
			player.addTempSkill(skill);
			const func = async target => {
				player.markAuto(skill, target);
				const card = new lib.element.VCard({ name: "sha", nature: "stab", isCard: true });
				if (player.canUse(card, target, false)) {
					const next = player.useCard(card, target, false);
					player
						.when("shaHit")
						.filter(evt => evt.getParent() == next)
						.step(async (event, trigger, player) => {
							player.addTempSkill("qljisha_effect");
							player.addMark("qljisha_effect", 1, false);
						});
					await next.forResult();
				}
			};
			await game.doAsyncInOrder(event.targets, func);
		},
		group: "qljisha_kill",
		subSkill: {
			discard: {
				charlotte: true,
				mark: true,
				intro: {
					content: "对$使用牌时弃置其一张牌",
				},
				onremove: true,
				trigger: {
					player: "useCardToPlayer",
				},
				filter(event, player) {
					if (!player.getStorage("qljisha_discard").includes(event.target)) {
						return false;
					}
					return event.target.countDiscardableCards(player, "he");
				},
				forced: true,
				logTarget: "target",
				async content(event, trigger, player) {
					await player.discardPlayerCard(trigger.target, "he", true);
				},
			},
			effect: {
				charlotte: true,
				mark: true,
				marktext: "杀",
				intro: {
					content: "你使用【杀】的次数限制+#",
				},
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("qljisha_effect");
						}
					},
				},
			},
			kill: {
				trigger: {
					source: "die",
				},
				filter(event, player) {
					return player.getStorage("qljisha_discard").includes(event.player) && game.openHuanzhang();
				},
				forced: true,
				async content(event, trigger, player) {
					if (game.countPlayer() >= 3) {
						const result = await player
							.chooseTarget(
								"击杀：是否移动至两名角色之间？",
								2,
								(card, player, target) => {
									if (target == player) {
										return false;
									}
									return ui.selected.targets.every(current => {
										return [target.getNext(), target.getPrevious()].includes(current);
									});
								},
								2
							)
							.set("complexTarget", true)
							.set("ai", target => {
								if (ui.select.targets.length) {
									if (target == ui.select.targets.getPrevious()) {
										return 2;
									}
									return 1;
								}
								const player = get.player();
								let num = 1,
									eff = get.sgnAttitude(player, target),
									current = target.getNext();
								while (current != target) {
									if (current == player) {
										continue;
									}
									num++;
									eff += get.sgnAttitude(player, current) / num;
									current = current.getNext();
								}
								return eff;
							})
							.forResult();
						if (result?.bool && result.targets?.length) {
							let target;
							if (result.targets[0] == result.targets[1].getPrevious()) {
								target = result.targets[1];
							} else {
								target = result.targets[0];
							}
							game.broadcastAll(
								function (target1, target2) {
									game.swapSeat(target1, target2, null, true);
								},
								player,
								target
							);
						}
					}
					player.insertPhase();
					player.addSkill("qljisha_damage");
					player.addMark("qljisha_damage", 1, false);
				},
			},
			damage: {
				charlotte: true,
				onremove: true,
				marktext: "伤",
				intro: {
					content: "造成伤害+#",
				},
				trigger: {
					source: "damageBegin1",
				},
				forced: true,
				async content(event, trigger, player) {
					trigger.num += player.countMark(event.name);
				},
			},
		},
	},
	qlhuajin: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			global: ["phaseZhunbeiBegin", "loseAsyncAfter"],
			player: ["gainAfter", "useCard"],
		},
		filter(event, player) {
			if (player != _status.currentPhase && !game.openHuanzhang()) {
				return false;
			}
			if (event.name == "useCard" && (!game.openZhizhi() || event.card?.name != "sha")) {
				return false;
			}
			const name = event.name == "loseAsync" ? "gain" : event.name;
			if (player.getStorage("qlhuajin_used").includes(name)) {
				return false;
			}
			if (name != "gain") {
				return true;
			}
			if (!event.getg(player)?.length) {
				return false;
			}
			if (event.name == "gain") {
				return event.notFromCardpile;
			}
			return event.getg(player).some(card => {
				return card.original != "c";
			});
		},
		forced: true,
		async content(event, trigger, player) {
			const name = trigger.name == "loseAsync" ? "gain" : trigger.name,
				skill = event.name;
			player.addTempSkill(`${skill}_used`);
			player.markAuto(`${skill}_used`, name);
			await player.draw();
			const cards = player.getCards("he");
			if (!cards.length) {
				return;
			}
			const cardx = player.getExpansions(skill);
			if (cardx.length >= 3) {
				const next = player.chooseToMove("化金：用一张牌交换一张“供奉”", true);
				next.set("list", [
					["你的“供奉”", cardx, skill],
					["你的牌", cards],
				]);
				next.set("filterMove", (from, to, moved) => {
					if (typeof to == "number") {
						return false;
					}
					const player = get.player(),
						hs = player.getCards("h");
					if (!moved[0].containsSome(...hs)) {
						return true;
					}
					const card1 = from.link,
						card2 = to.link;
					const bool1 = moved[0].includes(card1),
						bool2 = moved[0].includes(card2);
					if (bool1 == bool2) {
						return true;
					}
					if (bool1) {
						return hs.includes(card1) || !hs.includes(card2);
					}
					return hs.includes(card2) || !hs.includes(card1);
				});
				next.set("filterOk", moved => {
					const player = get.player(),
						hs = player.getCards("h");
					return moved[0].containsSome(...hs);
				});
				next.set("processAI", list => {
					const player = get.player(),
						cards1 = list[0][1],
						cards2 = list[1][1];
					return [
						[...cards1.slice(0, -1), cards2.at(-1)],
						[...cards2.slice(0, -1), cards1.at(-1)],
					];
				});
				const result = await next.forResult();
				if (result?.bool) {
					const pushs = result.moved[0],
						gains = result.moved[1];
					pushs.removeArray(cardx);
					gains.removeArray(cards);
					if (!pushs.length || pushs.length != gains.length) {
						return;
					}
					const next2 = player.addToExpansion(pushs, player, "giveAuto");
					next2.gaintag.add(skill);
					await next2;
					await player.gain(gains, "gain2");
				}
				return;
			}
			const result =
				cards.length > 1
					? await player
						.chooseCard("化金：将一张牌置于武将牌上，称为“供奉”", "he", true)
						.set("ai", card => {
							const player = get.player(),
								list = player.getExpansions("qlhuajin"),
								type = get.type2(card);
							if (list.every(cardx => get.type2(cardx) != type)) {
								return 15 - get.value(card);
							}
							return 5 - get.value(card);
						})
						.forResult()
					: {
						bool: true,
						cards: cards,
					};
			if (result?.bool && result.cards?.length) {
				const next = player.addToExpansion(result.cards, "giveAuto", player);
				next.gaintag.add(skill);
				await next;
			}
		},
		intro: {
			markcount: "expansion",
			content: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		mod: {
			targetInRange: () => true,
		},
		group: "qlhuajin_record",
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			record: {
				trigger: { player: "gainBefore" },
				filter(event, player) {
					if (!event.cards?.length) {
						return false;
					}
					if (event.getParent().name == "draw") {
						return false;
					}
					return event.cards.some(card => {
						const pos = get.position(card);
						if (pos) {
							return pos != "c";
						}
						return card.original != "c";
					});
				},
				async cost(event, trigger, player) {
					trigger.notFromCardpile = true;
				},
			},
		},
	},
	qlfucui: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			player: "useCardToPlayered",
		},
		filter(event, player) {
			if (event.card?.name != "sha") {
				return false;
			}
			return player.getExpansions("qlhuajin").length;
		},
		logTarget: "target",
		check(event, player) {
			return get.effect(event.target, event.card, player, player) > 0;
		},
		async content(event, trigger, player) {
			const cards = get.cards(3, true);
			const cardx = player.getExpansions("qlhuajin");
			const types = cardx.map(card => get.type2(card)).toUniqued();
			await player.showCards(cards, `${get.translation(player)}发动了【浮翠】`, true);
			for (const card of cards) {
				if (types.includes(get.type2(card))) {
					trigger.getParent().baseDamage++;
				}
			}
			const result = await player
				.chooseBool(`###浮翠###是否移去全部供奉牌，获得${get.translation(cards)}并令此杀不可被响应？`)
				.set(
					"choice",
					(() => {
						const getV = cards => {
							return cards.reduce((sum, card) => {
								return sum + get.value(card);
							}, 0);
						};
						if (getV(cards) >= getV(cardx)) {
							return true;
						}
						return types.containsAll(...cards.map(card => get.type2(card)).toUniqued());
					})()
				)
				.forResult();
			if (!result?.bool) {
				return;
			}
			await player.loseToDiscardpile(cardx);
			await player.gain(cards, "gain2");
			trigger.getParent().directHit.addArray(game.players);
			if (!types.containsAll(...cards.map(card => get.type2(card)).toUniqued())) {
				return;
			}
			if (game.openZhizhi()) {
				const card = get.cardPile(card => card.name == "sha");
				if (card) {
					await player.gain(card, "gain2");
				}
			}
			if (!game.countPlayer(() => true)) {
				return;
			}
			const result2 = await player
				.chooseTarget("浮翠：对一名角色造成1点伤害", true)
				.set("ai", target => {
					const player = get.player();
					return get.damageEffect(target, player, player);
				})
				.forResult();
			if (result2?.bool) {
				const target = result2.targets[0];
				player.line(target);
				await target.damage();
				if (game.openHuanzhang()) {
					await target.turnOver();
					player.insertPhase();
				}
			}
		},
	},
	qlfangdao: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			player: ["damageBegin3", "turnOverAfter"],
			source: "damageBegin1",
		},
		locked: true,
		filter(event, player, name) {
			if (name == "damageBegin1") {
				return game.openZhizhi() && event.player.isTurnedOver();
			}
			return event.name != "damage" || player.isTurnedOver();
		},
		async cost(event, trigger, player) {
			switch (event.triggername) {
				case "damageBegin1": {
					event.result = {
						bool: true,
						targets: [trigger.player],
					};
					return;
				}
				case "damageBegin3": {
					event.result = await player.chooseBool(get.prompt2(event.skill)).forResult();
					return;
				}
				default: {
					event.result = {
						bool: true,
					};
					return;
				}
			}
		},
		async content(event, trigger, player) {
			switch (event.triggername) {
				case "damageBegin1": {
					trigger.num++;
					return;
				}
				case "damageBegin3": {
					trigger.cancel();
					await player.turnOver(false);
					if (trigger.source?.isIn()) {
						await trigger.source.turnOver();
					}
					if (player.isDamaged()) {
						await player.recover();
					}
					if (game.openHuanzhang()) {
						player.insertPhase();
					}
					return;
				}
				default: {
					await player.draw(game.openZhizhi() ? 3 : 2);
					if (game.openHuanzhang() && !game.hasPlayer(current => current.isTurnedOver())) {
						const result = await player
							.chooseTarget(get.prompt2(event.name), (card, player, target) => {
								return get.event().targetx.includes(target);
							})
							.set(
								"targetx",
								game.filterPlayer(current => {
									if (current == player) {
										return false;
									}
									return true;
								})
							)
							.set("ai", target => {
								const player = get.player();
								return get.attitude(player, target) * target.countCards("he");
							})
							.forResult();
						if (result.bool) {
							await result.targets[0].turnOver();
						}
					}
					return;
				}
			}
		},
	},
	qlbuqi: {
		audio: "ext:五花米线/audio/skill:2",
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			if (!get.tag(event.card, "damage")) {
				return false;
			}
			return game.hasPlayer(current => {
				if (current == player) {
					return false;
				}
				return game.openZhizhi() || player.inRangeOf(current);
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return get.event().targetx.includes(target);
				})
				.set(
					"targetx",
					game.filterPlayer(current => {
						if (current == player) {
							return false;
						}
						return game.openZhizhi() || player.inRangeOf(current);
					})
				)
				.set("ai", target => {
					const player = get.player();
					return get.attitude(player, target) * target.countCards("he");
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event,
				bool = (() => {
					if (!trigger.targets?.length) {
						return false;
					}
					return ["basic", "trick"].includes(get.type(trigger.card));
				})();
			let prompt = `交给${get.translation(player)}一张牌`;
			if (bool) {
				prompt = `${prompt}并令${get.translation(trigger.card)}额外结算一次`;
			}
			prompt = `${prompt}，否则其翻面`;
			const result = await target
				.chooseToGive(player, "he", prompt)
				.set("ai", card => {
					if (get.event().att > 0) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("att", get.attitude(target, player))
				.forResult();
			if (result?.bool) {
				game.log(trigger.card, "额外结算一次");
				trigger.effectCount++;
			} else {
				await player.turnOver();
			}
		},
	},
	//越王勾践
	qlwoxin: {
		audio: "ext:五花米线/audio/skill:2",
		nobracket: true,
		persevereSkill: true,
		group: ["qlwoxin_damage", "qlwoxin_dist"],
		trigger: {
			source: "damageSource",
			player: "useCard",
		},
		forced: true,
		filter(event, player) {
			if (event.name == "useCard") {
				return event.card.name == "sha";
			}
			return true;
		},
		priority: 100,
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				player.addMark("qlwoxin_jianming", trigger.num);
			} else {
				player.addMark("qlwoxin_zhefu");
			}
		},
		subSkill: {
			jianming: {
				marktext: "剑",
				intro: {
					name: "剑鸣",
					name2: "剑鸣",
					content: "mark",
				},
			},
			zhefu: {
				marktext: "蛰",
				intro: {
					name: "蛰伏",
					name2: "蛰伏",
					content: "mark",
				},
			},
			dist: {
				mod: {
					globalFrom(from, to, distance) {
						return distance - from.countMark("qlwoxin_jianming");
					},
				},
			},
			damage: {
				audio: "qlwoxin",
				forced: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return !player.storage.qlwoxin_damage && event.num != 1;
				},
				lastDo: true,
				async content(event, trigger, player) {
					trigger.num = 1;
				},
			},
		},
	},
	qlchengxu: {
		audio: "ext:五花米线/audio/skill:2",
		nobracket: true,
		persevereSkill: true,
		enable: "chooseToUse",
		/*mod: {
			cardUsable(card, player, num) {
				if (card?.storage?.qlchengxu) {
					return Infinity;
				}
			}
		},*/
		locked: true,
		hiddenCard(player, name) {
			return player.hasCard(card => get.name(card) == name, "h") && ["basic", "trick"].includes(get.type({ name: name }));
		},
		getCard(card, player) {
			return get.autoViewAs({
				name: get.name(card, player),
				suit: "none",
				nature: get.nature(card, player),
				number: null,
				isCard: true,
				storage: {
					qlchengxu: card,
				},
			});
		},
		filter(event, player) {
			return player.hasCard(card => {
				return ["basic", "trick"].includes(get.type(card)) && event.filterCard(get.info("qlchengxu").getCard(card, player), player, event);
			});
		},
		filterCard(card, player, event) {
			event = event || _status.event;
			return ["basic", "trick"].includes(get.type(card)) && event._backup.filterCard(get.info("qlchengxu").getCard(card, player), player, event);
		},
		check(card) {
			return get.order(card, get.player()) + 1;
		},
		ignoreMod: true,
		position: "h",
		viewAs(cards, player) {
			if (cards.length) {
				const card = cards[0];
				return {
					name: get.name(card, player),
					suit: "none",
					nature: get.nature(card, player),
					number: null,
					isCard: true,
					storage: {
						qlchengxu: card,
					},
				};
			}
			return null;
		},
		prompt: "展示并视为使用一张牌",
		log: false,
		async precontent(event, trigger, player) {
			player.logSkill("qlchengxu");
			const { cards, card } = event.result;
			await player.showCards(cards, `${get.translation(player)}发动了【乘虚而入】`);
			event.result.cards = [];
			event.result.card = get.autoViewAs({ name: card.name, nature: card.nature, isCard: true, storage: card.storage });
			event.getParent().addCount = false;
			event.getParent().oncard = function () {
				const card = get.event().card;
				player
					.when("useCardAfter")
					.filter(evt => evt.card == card)
					.step(async (event, trigger, player) => {
						const card = trigger.card.storage.qlchengxu;
						if (player.isPhaseUsing()) {
							if (player.hasUseTarget(card, true, false)) {
								await player.chooseUseTarget(card, true, false);
							}
						} else {
							await player.recast(card);
						}
					});
			};
		},
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
	},
	qlyuejia: {
		audio: "ext:五花米线/audio/skill:2",
		nobracket: true,
		persevereSkill: true,
		juexingji: true,
		derivation: ["qlweiye", "qlhongtu"],
		skillAnimation: true,
		animationColor: "metal",
		forced: true,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countMark("qlwoxin_zhefu") >= 4;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const num = player.countMark("qlwoxin_zhefu");
			player.removeMark("qlwoxin_zhefu", num);
			await player.draw(num);
			player.addSkill("qlyuejia_handcard");
			player.addMark("qlyuejia_handcard", num, false);
			const card = game.createCard2("qlyuewanggoujianjian", "club", 4);
			await player.gain(card, "gain2");
			if (player.hasUseTarget(card, true, false) && player.getCards("h").includes(card)) {
				await player.chooseUseTarget(card, true);
			}
			game.log(player, "修改了", "#g【卧薪尝胆】");
			player.setStorage("qlwoxin_damage", true);
			await player.addSkills(["qlhongtu", "qlweiye"]);
			player.insertPhase();
		},
		subSkill: {
			handcard: {
				charlotte: true,
				markimage: "image/card/handcard.png",
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("qlyuejia_handcard");
					},
				},
				intro: {
					content: "手牌上限+#",
				},
			},
		},
		ai: {
			combo: "qlwoxin",
		},
	},
	qlhongtu: {
		audio: "ext:五花米线/audio/skill:2",
		nobracket: true,
		persevereSkill: true,
		group: ["qlhongtu_add", "qlhongtu_gain", "qlhongtu_effect1", "qlhongtu_effect2", "qlhongtu_equip"],
		init(player, skill) {
			get.info(skill).addToExpansion(player);
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) player.loseToDiscardpile(cards);
		},
		async addToExpansion(player) {
			const cards = player.getExpansions("qlhongtu");
			if (cards.length < player.maxHp) {
				const num = player.maxHp - cards.length;
				const toAdd = get.cards(num, true);
				const next = player.addToExpansion(toAdd, "gain2");
				next.gaintag.add("qlhongtu");
				game.log(player, "将", toAdd, "置于武将牌上");
				return next;
			}
		},
		intro: {
			markcount: "expansion",
			content: "expansion",
		},
		trigger: {
			player: ["phaseZhunbeiBegin", "damageEnd"],
			source: "damageSource",
		},
		filter(event, player) {
			return player.countDiscardableCards(player, "he") && player.countExpansions("qlhongtu");
		},
		async cost(event, trigger, player) {
			const num = player.countExpansions("qlhongtu");
			event.result = await player
				.discardPlayerCard(player, `###${get.prompt(event.skill)}###弃置任意张牌然后获得武将牌上等量张牌`, [1, num], "hej")
				.set("chooseonly", true)
				.set("ai", button => {
					if (get.position(button.link) == "j" && get.effect(player, button.link, player, player)) {
						return 100;
					}
					const card = button.link;
					const cards = player.getExpansions("qlhongtu");
					const val = get.tag(card, "damage") > 0.5 ? 0 : 3;
					if (get.event().suits.length < 3 && game.hasPlayer(target => get.effect(target, { name: "shunshou" }, player, player) > 0)) {
						return ui.selected.cards?.length < cards.length - 1 ? 6 - get.value(card) + val : 0;
					}
					return 5.5 - get.value(card) + val;
				})
				.set(
					"suits",
					player
						.getExpansions("qlhongtu")
						.map(i => get.suit(i))
						.unique()
				)
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			await player.discard(cards).set("discarder", player);
			const result = await player
				.chooseButton([`请选择获得${get.cnNumber(cards.length)}张牌`, player.getExpansions("qlhongtu")], cards.length, true)
				.set("ai", button => {
					const card = button.link;
					const val = get.tag(card, "damage") > 0.5 ? 3 : 0;
					return get.value(card) + val;
				})
				.forResult();
			if (result?.links?.length) {
				await player.gain(result.links, "gain2");
			}
		},
		subSkill: {
			equip: {
				audio: "qlhongtu",
				forced: true,
				mod: {
					canBeGained(card, source, player) {
						if (player.getEquips("qlyuewanggoujianjian").includes(card)) {
							return false;
						}
					},
					canBeDiscarded(card, source, player) {
						if (player.getEquips("qlyuewanggoujianjian").includes(card)) {
							return false;
						}
					},
					canBeReplaced(card, player) {
						if (player.getVEquips("qlyuewanggoujianjian").includes(card)) {
							return false;
						}
					},
					cardDiscardable(card, player) {
						if (player.getEquips("qlyuewanggoujianjian").includes(card)) {
							return false;
						}
					},
					cardEnabled2(card, player) {
						if (player.getEquips("qlyuewanggoujianjian").includes(card)) {
							return false;
						}
					},
				},
				trigger: {
					player: ["loseBefore", "disableEquipBefore"],
				},
				forced: true,
				filter(event, player) {
					if (event.name == "disableEquip") {
						return event.slots.includes("equip1");
					}
					var cards = player.getEquips("qlyuewanggoujianjian");
					return event.cards.some(card => cards.includes(card));
				},
				content() {
					if (trigger.name == "lose") {
						trigger.cards.removeArray(player.getEquips("qlyuewanggoujianjian"));
					} else {
						while (trigger.slots.includes("equip1")) {
							trigger.slots.remove("equip1");
						}
					}
				},
			},
			effect1: {
				audio: "qlhongtu",
				forced: true,
				trigger: {
					player: ["useCard", "damageBegin4"],
				},
				filter(event, player) {
					if (event.name == "useCard") {
						return lib.skill.dcshixian.filterx(event) && player.getExpansions("qlhongtu").some(card => get.name(card) == get.name(event.card));
					}
					return !event.card || (event.card && !player.getExpansions("qlhongtu").some(card => get.suit(card) == get.suit(event.card)));
				},
				async content(event, trigger, player) {
					if (trigger.name == "useCard") {
						trigger.effectCount++;
						game.log(trigger.card, "额外结算一次");
					} else {
						trigger.cancel();
					}
				},
			},
			effect2: {
				audio: "qlhongtu",
				forced: true,
				trigger: {
					player: ["loseAfter"],
					global: ["gainAfter", "loseAfter", "addToExpansionAfter", "addJudgeAfter", "equipAfter"],
				},
				priority: 99,
				filter(event, player) {
					let bool = false;
					if (event.name == "addToExpansion" && event.gaintag.includes("qlhongtu")) {
						bool = true;
					}
					const gaintag_map = event.getl?.(player)?.gaintag_map;
					if (event.getl?.(player)?.xs?.some(card => gaintag_map[card.cardid].includes("qlhongtu"))) {
						bool = true;
					}
					if (bool) {
						const suits = player
							.getExpansions("qlhongtu")
							.map(i => get.suit(i))
							.unique();
						return suits.length == 1 || suits.length == 4;
					}
					return false;
				},
				async content(event, trigger, player) {
					const cards = player.getExpansions("qlhongtu");
					const suits = cards.map(i => get.suit(i)).unique();
					if (suits.length == 1) {
						const result = await player
							.chooseButton([`宏图霸业：获得其中一张牌`, cards], true)
							.set("ai", button => get.value(button.link))
							.forResult();
						if (result?.links?.length) {
							await player.gain(result.links, "gain2");
						}
						if (!game.hasPlayer(target => target.countGainableCards(player, "hej"))) {
							return;
						}
						const result2 = await player
							.chooseTarget("宏图霸业：获得一名角色区域内一张牌", true, (card, player, target) => target.countGainableCards(player, "hej"))
							.set("ai", target => get.effect(target, { name: "shunshou" }, get.player(), get.player()))
							.forResult();
						if (result2?.targets?.length) {
							const [target] = result2.targets;
							player.line(target);
							await player.gainPlayerCard(target, "hej", true);
						}
					} else if (suits.length == 4 && game.hasPlayer(target => target != player)) {
						await player.loseToDiscardpile(cards);
						const result = await player
							.chooseTarget("宏图霸业：对一名角色造成4点伤害", true, lib.filter.notMe)
							.set("ai", target => get.damageEffect(target, get.player(), get.player()))
							.forResult();
						if (result?.targets?.length) {
							const {
								targets: [target],
							} = result;
							player.line(target);
							await target.damage(4);
						}
					}
				},
			},
			gain: {
				audio: "qlhongtu",
				forced: true,
				trigger: {
					player: ["loseAfter"],
					global: ["gainAfter", "loseAfter", "addToExpansionAfter", "addJudgeAfter", "equipAfter"],
				},
				filter(event, player) {
					if (player.countCards("h")) {
						return false;
					}
					var evt = event.getl(player);
					return evt?.hs?.length && player.countExpansions("qlhongtu");
				},
				async content(event, trigger, player) {
					const cards = player.getExpansions("qlhongtu");
					await player.gain(cards, "gain2");
				},
			},
			add: {
				audio: "qlhongtu",
				forced: true,
				trigger: {
					player: ["loseAfter"],
					global: ["gainAfter", "loseAfter", "addToExpansionAfter", "addJudgeAfter", "equipAfter"],
				},
				priority: 100,
				filter(event, player) {
					if (event.name == "changeSkills") {
						return event.addSkill.includes("qlhongtu");
					}
					const gaintag_map = event.getl?.(player)?.gaintag_map;
					return event.getl?.(player)?.xs?.some(card => gaintag_map[card.cardid].includes("qlhongtu"));
				},
				async content(event, trigger, player) {
					await get.info("qlhongtu").addToExpansion(player);
				},
			},
		},
	},
	qlyuewanggoujianjian: {
		equipSkill: true,
		trigger: {
			source: "damageBegin2",
			player: "phaseBegin",
		},
		filter(event, player) {
			if (event.name == "phase") {
				return player.countMark("qlwoxin_jianming");
			}
			return true;
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phase") {
				const num = Math.min(4, player.countMark("qlwoxin_jianming"));
				const list = Array.from({ length: num }).map((_, i) => i + 1);
				const result = await player
					.chooseControl(list, "cancel2")
					.set("prompt", get.prompt(event.skill))
					.set("prompt2", `移去至多${get.cnNumber(num)}枚“剑鸣”，然后获得前等量项效果直到你下个回合开始：使用牌无视防具/摸一张牌/无次数限制/伤害翻倍。`)
					.set("choice", list.length - 1)
					.forResult();
				if (result?.control !== "cancel2") {
					event.result = { bool: true, cost_data: result.control };
				}
			} else {
				const list = lib.inpile_nature.slice();
				const getEffect = nature => {
					return get.damageEffect(trigger.player, player, player, nature);
				};
				const result = await player
					.chooseControl(list, "cancel2")
					.set("prompt", get.prompt(event.skill, trigger.player))
					.set("prompt2", "修改此次伤害的属性")
					.set("choice", list.sort((a, b) => getEffect(b) - getEffect(a))[0])
					.forResult();
				if (result?.control !== "cancel2") {
					event.result = { bool: true, cost_data: result.control };
				}
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				const nature = event.cost_data;
				game.setNature(trigger, nature);
			} else {
				const num = event.cost_data;
				player.removeMark("qlwoxin_jianming", num);
				player.addTempSkill(`${event.name}_effect`, { player: "phaseBeginStart" });
				player.addMark(`${event.name}_effect`, num, false);
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (player.countMark("qlyuewanggoujianjian_effect") >= 3) {
							return Infinity;
						}
					},
				},
				forced: true,
				priority: 99,
				intro: {
					content: "上次移去“龙鸣”：#",
				},
				trigger: { player: "useCard" },
				filter(event, player) {
					return player.countMark("qlyuewanggoujianjian_effect");
				},
				async content(event, trigger, player) {
					const num = player.countMark(event.name);
					if (num >= 1) {
						trigger.card.storage ??= {};
						trigger.card.storage[event.name] = true;
						game.log(trigger.card, "无视防具");
					}
					if (num >= 2) {
						await player.draw();
					}
					if (num >= 3 && trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] == "number") {
							stat[name]--;
						}
						game.log(trigger.card, "不计入次数");
					}
					if (num >= 4 && get.tag(trigger.card, "damage") > 0.5) {
						trigger.baseDamage *= 2;
						game.log(trigger.card, "造成的伤害翻倍");
					}
				},
				ai: {
					unequip: true,
					skillTagFilter(player, tag, arg) {
						if (!arg?.card?.storage?.qlyuewanggoujianjian_effect) {
							return false;
						}
					},
				},
			},
		},
	},
	qldanggu: {
		trigger: {
			player: "enterGame",
			global: "phaseBefore",
		},
		persevereSkill: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		derivation: ["mbdanggu_faq", "mbdanggu_faq2", "qltaoluan", "qlchiyan", "qlzimou", "qlpicai", "qlyaozhuo", "qlxiaolu", "scskuiji", "qlchihe", "qlniqu", "qlmiaoyu"],
		forced: true,
		unique: true,
		onremove(player) {
			delete player.storage.qldanggu;
			delete player.storage.qldanggu_current;
			if (lib.skill.qldanggu.isSingleShichangshi(player)) {
				game.broadcastAll(function (player) {
					player.name1 = player.name;
					player.skin.name = player.name;
					player.smoothAvatar(false);
					player.node.avatar.setBackground(player.name, "character");
					player.node.name.innerHTML = get.slimName(player.name);
					delete player.name2;
					delete player.skin.name2;
					player.classList.remove("fullskin2");
					player.node.avatar2.classList.add("hidden");
					player.node.name2.innerHTML = "";
					if (player == game.me && ui.fakeme) {
						ui.fakeme.style.backgroundImage = player.node.avatar.style.backgroundImage;
					}
				}, player);
			}
		},
		changshi: [
			["scs_zhangrang", "qltaoluan"],
			["scs_zhaozhong", "qlchiyan"],
			["scs_sunzhang", "qlzimou"],
			["scs_bilan", "qlpicai"],
			["scs_xiayun", "qlyaozhuo"],
			["scs_hankui", "qlxiaolu"],
			["scs_lisong", "scskuiji"],
			["scs_duangui", "qlchihe"],
			["scs_guosheng", "qlniqu"],
			["scs_gaowang", "qlmiaoyu"],
		],
		async content(event, trigger, player) {
			const list = lib.skill.qldanggu.changshi.map(i => i[0]);
			player.markAuto("qldanggu", list);
			game.broadcastAll(
				function (player, list) {
					const cards = [];
					for (let i = 0; i < list.length; i++) {
						const cardname = "huashen_card_" + list[i];
						lib.card[cardname] = {
							fullimage: true,
							image: "character/" + list[i],
						};
						lib.translate[cardname] = get.rawName2(list[i]);
						cards.push(game.createCard(cardname, "", ""));
					}
					player.$draw(cards, "nobroadcast");
				},
				player,
				list
			);
			const next = game.createEvent("qldanggu_clique");
			next.player = player;
			next.setContent(lib.skill.qldanggu.contentx);
			await next;
		},
		async contentx(event, trigger, player) {
			let list = player.getStorage("qldanggu").slice();
			const first = list.randomRemove();
			const others = list.randomGets(4);
			let result;
			if (others.length == 1) {
				result = { bool: true, links: others };
			} else {
				result = await player
					.chooseButton(["党锢：请选择结党对象", [[first], "character"], '<div class="text center">可选常侍</div>', [others, "character"]], true)
					.set("filterButton", button => {
						return _status.event.canChoose.includes(button.link);
					})
					.set("canChoose", list)
					.set("ai", button => Math.random() * 10)
					.forResult();
			}
			if (result?.bool) {
				const chosen = result.links[0];
				const skills = [];
				list = lib.skill.qldanggu.changshi;
				const changshis = [first, chosen];
				player.unmarkAuto("qldanggu", changshis);
				player.storage.qldanggu_current = changshis;
				for (const changshi of changshis) {
					for (const cs of list) {
						if (changshi == cs[0]) {
							skills.push(cs[1]);
						}
					}
				}
				if (lib.skill.qldanggu.isSingleShichangshi(player)) {
					game.broadcastAll(
						function (player, first, chosen) {
							player.name1 = first;
							player.node.avatar.setBackground(first, "character");
							player.node.name.innerHTML = get.slimName(first);
							player.name2 = chosen;
							player.skin.name = first;
							player.skin.name2 = chosen;
							player.classList.add("fullskin2");
							player.node.avatar2.classList.remove("hidden");
							player.node.avatar2.setBackground(chosen, "character");
							player.node.name2.innerHTML = get.slimName(chosen);
							if (player == game.me && ui.fakeme) {
								ui.fakeme.style.backgroundImage = player.node.avatar.style.backgroundImage;
							}
						},
						player,
						first,
						chosen
					);
				}
				game.log(player, "选择了常侍", "#y" + get.translation(changshis));
				if (skills.length) {
					player.addAdditionalSkill("qldanggu", skills);
					let str = "";
					for (const i of skills) {
						str += "【" + get.translation(i) + "】、";
						player.popup(i);
					}
					str = str.slice(0, -1);
					game.log(player, "获得了技能", "#g" + str);
				}
			}
		},
		isSingleShichangshi(player) {
			var map = lib.skill.mbdanggu.conflictMap(player);
			return player.name == "qlshichangshi" && ((map[player.name1] && map[player.name2]) || (map[player.name1] && !player.name2) || (!player.name1 && !player.name2) || (player.name == player.name1 && !player.name2));
		},
		mod: {
			aiValue(player, card, num) {
				if (["shan", "tao", "wuxie", "caochuan"].includes(card.name)) {
					return num / 10;
				}
			},
			aiUseful() {
				return lib.skill.qldanggu.mod.aiValue.apply(this, arguments);
			},
		},
		ai: {
			combo: "qlmowang",
			nokeep: true,
		},
		intro: {
			mark(dialog, storage, player) {
				dialog.addText("剩余常侍");
				dialog.addSmall([storage, "character"]);
				if (player.storage.qldanggu_current && player.isIn()) {
					dialog.addText("当前常侍");
					dialog.addSmall([player.storage.qldanggu_current, "character"]);
				}
			},
		},
		skill_id: "qldanggu",
		_priority: 0,
	},
	qlmowang: {
		trigger: {
			player: ["dieBefore", "rest", "dieAfter"],
		},
		filter(event, player, name) {
			if (name == "rest") {
				return true;
			}
			if (name == "dieAfter") {
				return event.reserveOut;
			}
			return event.getParent().name != "giveup" && player.maxHp > 0;
		},
		derivation: "qlmowang_faq",
		forced: true,
		forceDie: true,
		forceOut: true,
		direct: true,
		priority: 15,
		group: ["qlmowang_die", "qlmowang_return"],
		async content(event, trigger, player) {
			if (event.triggername == "rest") {
				game.broadcastAll(
					function (player, list) {
						//player.classList.add("out");
						if (list.includes(player.name1) || player.name1 == "shichangshi") {
							player.smoothAvatar(false);
							player.skin.name = player.name1 + "_dead";
							player.node.avatar.setBackground(player.name1 + "_dead", "character");
						}
						if (list.includes(player.name2) || player.name2 == "shichangshi") {
							player.smoothAvatar(true);
							player.skin.name2 = player.name2 + "_dead";
							player.node.avatar2.setBackground(player.name2 + "_dead", "character");
						}
					},
					player,
					lib.skill.mbdanggu.changshi.map(i => i[0])
				);
			} else if (event.triggername == "dieAfter") {
				if (player.getStorage("qldanggu").length) {
					game.broadcastAll(function () {
						if (lib.config.background_speak) {
							game.playAudio("die", "shichangshiRest");
						}
					});
					await player.rest({ type: "round", count: 1 }); //, audio: "shichangshiRest"
				}
			} else {
				if (player.isRest()) {
					trigger.cancel();
				} else {
					if (player.getStorage("qldanggu").length) {
						player.logSkill("qlmowang");
						//煞笔十常侍
						trigger.excludeMark.add("qldanggu");
						trigger.noDieAudio = true;
						//trigger.includeOut = true;
						trigger.reserveOut = true;
					} else {
						game.broadcastAll(function (player) {
							player.name1 = player.name;
							player.skin.name = player.name + "_dead";
							player.smoothAvatar(false);
							player.node.avatar.setBackground(player.name + "_dead", "character");
							player.node.name.innerHTML = get.slimName(player.name);
							delete player.name2;
							delete player.skin.name2;
							player.classList.remove("fullskin2");
							player.node.avatar2.classList.add("hidden");
							player.node.name2.innerHTML = "";
							if (player == game.me && ui.fakeme) {
								ui.fakeme.style.backgroundImage = player.node.avatar.style.backgroundImage;
							}
						}, player);
					}
				}
			}
		},
		ai: {
			combo: "qldanggu",
			neg: true,
		},
		subSkill: {
			die: {
				audio: "qlmowang",
				trigger: { player: "phaseAfter" },
				forced: true,
				//forceDie: true,
				async content(event, trigger, player) {
					if (lib.skill.mbdanggu.isSingleShichangshi(player)) {
						if (!player.getStorage("qldanggu").length) {
							game.broadcastAll(function (player) {
								player.name1 = player.name;
								player.skin.name = player.name + "_dead";
								player.smoothAvatar(false);
								player.node.avatar.setBackground(player.name + "_dead", "character");
								player.node.name.innerHTML = get.slimName(player.name);
								delete player.name2;
								delete player.skin.name2;
								player.classList.remove("fullskin2");
								player.node.avatar2.classList.add("hidden");
								player.node.name2.innerHTML = "";
								if (player == game.me && ui.fakeme) {
									ui.fakeme.style.backgroundImage = player.node.avatar.style.backgroundImage;
								}
							}, player);
						}
					}
					if (!player.getStorage("qldanggu").length) {
						await game.delay();
					}
					await player.die();
				},
			},
			return: {
				trigger: { player: "restEnd" },
				forced: true,
				charlotte: true,
				silent: true,
				forceDie: true,
				forceOut: true,
				filter(event, player) {
					return event.player == player && player.hasSkill("qldanggu", null, null, false);
				},
				async content(event, trigger, player) {
					game.broadcastAll(function (player) {
						if (player.name1 == "shichangshi") {
							player.smoothAvatar(false);
							player.node.avatar.setBackground(player.name1, "character");
							if (!lib.skill.mbdanggu.isSingleShichangshi(player)) {
								player.skin.name = player.name1;
							}
						}
						if (player.name2 == "shichangshi") {
							player.smoothAvatar(true);
							player.node.avatar2.setBackground(player.name2, "character");
							if (!lib.skill.mbdanggu.isSingleShichangshi(player)) {
								player.skin.name2 = player.name2;
							}
						}
					}, player);
					delete player.storage.qldanggu_current;
					if (lib.skill.mbdanggu.isSingleShichangshi(player)) {
						game.broadcastAll(function (player) {
							player.name1 = player.name;
							player.skin.name = player.name;
							player.smoothAvatar(false);
							player.node.avatar.setBackground(player.name, "character");
							player.node.name.innerHTML = get.slimName(player.name);
							delete player.name2;
							delete player.skin.name2;
							player.classList.remove("fullskin2");
							player.node.avatar2.classList.add("hidden");
							player.node.name2.innerHTML = "";
							if (player == game.me && ui.fakeme) {
								ui.fakeme.style.backgroundImage = player.node.avatar.style.backgroundImage;
							}
						}, player);
					}
					const next = game.createEvent("qldanggu_clique");
					next.player = player;
					next.setContent(lib.skill.qldanggu.contentx);
					await next;
					await player.drawTo(4);
				},
			},
		},
	},
	qltaoluan: {
		audio: "scstaoluan",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("hes") > 0;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i = 0; i < lib.inpile.length; i++) {
					var name = lib.inpile[i];
					if (name == "sha") {
						list.push(["基本", "", "sha"]);
						for (var j of lib.inpile_nature) {
							list.push(["基本", "", "sha", j]);
						}
					} else if (get.type(name) == "trick") {
						list.push(["锦囊", "", name]);
					} else if (get.type(name) == "basic") {
						list.push(["基本", "", name]);
					} else if (get.type(name) == "delay") {
						list.push(["锦囊", "", name]);
					}
				}
				return ui.create.dialog("滔乱", [list, "vcard"]);
			},
			filter(button, player) {
				return _status.event.getParent().filterCard({ name: button.link[2] }, player, _status.event.getParent());
			},
			check(button) {
				var player = _status.event.player;
				if (player.countCards("hs", button.link[2]) > 0) {
					return 0;
				}
				if (button.link[2] == "wugu") {
					return;
				}
				var effect = player.getUseValue(button.link[2]);
				if (effect > 0) {
					return effect;
				}
				return 0;
			},
			backup(links, player) {
				return {
					filterCard: true,
					audio: "scstaoluan",
					selectCard: 1,
					popname: true,
					check(card) {
						return 6 - get.value(card);
					},
					position: "hes",
					viewAs: { name: links[0][2], nature: links[0][3] },
					precontent() {
						player.draw();
					},
				};
			},
			prompt(links, player) {
				return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order: 4,
			result: {
				player: 1,
			},
			threaten: 1.9,
		},
		subSkill: {
			backup: {
				sub: true,
				sourceSkill: "qltaoluan",
				_priority: 0,
				skill_id: "qltaoluan_backup",
			},
		},
		skill_id: "qltaoluan",
		_priority: 0,
	},
	qlchiyan: {
		audio: "scschiyan",
		trigger: {
			player: "useCardToPlayered",
		},
		direct: true,
		filter(event, player) {
			return event.card.name == "sha" && event.target.hp > 0 && event.target.countCards("he") > 0;
		},
		content() {
			"step 0";
			var next = player.choosePlayerCard([1, trigger.target.hp], trigger.target, "he", get.prompt("qlchiyan", trigger.target));
			next.set("ai", function (button) {
				if (!_status.event.goon) {
					return 0;
				}
				var val = get.value(button.link);
				if (button.link == _status.event.target.getEquip(2)) {
					return 2 * (val + 3);
				}
				return val;
			});
			next.set("goon", get.attitude(player, trigger.target) <= 0);
			next.set("forceAuto", true);
			("step 1");
			if (result.bool) {
				var target = trigger.target;
				player.logSkill("qlchiyan", target);
				target.addSkill("qlchiyan_get");
				target.addToExpansion("giveAuto", result.cards, target).gaintag.add("qlchiyan_get");
			}
		},
		ai: {
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (get.attitude(player, arg.target) > 0) {
					return false;
				}
				if (tag == "directHit_ai") {
					return arg.target.hp >= Math.max(1, arg.target.countCards("h") - 1);
				}
				if (arg && arg.name == "sha" && arg.target.getEquip(2)) {
					return true;
				}
				return false;
			},
		},
		group: "qlchiyan_damage",
		subSkill: {
			get: {
				trigger: {
					global: "phaseEnd",
				},
				forced: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					return player.getExpansions("qlchiyan_get").length > 0;
				},
				content() {
					"step 0";
					var cards = player.getExpansions("qlchiyan_get");
					player.gain(cards, "draw");
					game.log(player, "收回了" + get.cnNumber(cards.length) + "张“鸱咽”牌");
					("step 1");
					player.removeSkill("qlchiyan_get");
				},
				intro: {
					markcount: "expansion",
					mark(dialog, storage, player) {
						var cards = player.getExpansions("qlchiyan_get");
						if (player.isUnderControl(true)) {
							dialog.addAuto(cards);
						} else {
							return "共有" + get.cnNumber(cards.length) + "张牌";
						}
					},
				},
				sub: true,
				sourceSkill: "qlchiyan",
				_priority: 0,
				skill_id: "qlchiyan_get",
			},
			damage: {
				audio: "scschiyan",
				trigger: {
					source: "damageBegin1",
				},
				forced: true,
				locked: false,
				logTarget: "player",
				filter(event, player) {
					var target = event.player;
					return event.getParent().name == "sha";
				},
				content() {
					trigger.num++;
				},
				sub: true,
				sourceSkill: "qlchiyan",
				_priority: 0,
				skill_id: "qlchiyan_damage",
			},
		},
		_priority: 0,
		skill_id: "qlchiyan",
	},
	qlzimou: {
		audio: "scszimou",
		trigger: {
			player: "useCard",
		},
		forced: true,
		filter(event, player) {
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != player) {
				return false;
			}
			var num = player.getHistory("useCard", evtx => evtx.getParent("phaseUse") == evt).length;
			return num == 3 || num == 5 || num == 8;
		},
		content() {
			var evt = trigger.getParent("phaseUse");
			var num = player.getHistory("useCard", evtx => evtx.getParent("phaseUse") == evt).length;
			var cards = [];
			if (num == 3) {
				var card = get.cardPile2(card => {
					return ["jiu", "xionghuangjiu"].includes(card.name);
				});
				var card2 = get.cardPile2(card => {
					return card.name == "guohe";
				});
				if (card) {
					cards.push(card);
				}
				if (card2) {
					cards.push(card2);
				}
			} else if (num == 5) {
				var card = get.cardPile2(card => {
					return card.name == "sha";
				});
				if (card) {
					cards.push(card);
				}
				var card2 = get.cardPile2(card => {
					return card.name == "shunshou";
				});
				if (card2) {
					cards.push(card2);
				}
			} else if (num == 8) {
				var card = get.cardPile2(card => {
					return card.name == "juedou";
				});
				if (card) {
					cards.push(card);
				}
				var card2 = get.cardPile2(card => {
					return card.name == "wuzhong";
				});
				if (card2) {
					cards.push(card2);
				}
			}
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
		_priority: 0,
		skill_id: "qlzimou",
	},
	qlyaozhuo: {
		audio: "scsyaozhuo",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return player.canCompare(current);
			});
		},
		filterTarget(card, player, current) {
			return player.canCompare(current);
		},
		content() {
			"step 0";
			player.chooseToCompare(target);
			("step 1");
			if (result.bool) {
				target.skip("phaseDraw");
				target.addTempSkill("qlyaozhuo_skip", { player: "phaseDrawSkipped" });
			} else {
				player.draw();
			}
		},
		subSkill: {
			skip: {
				mark: true,
				intro: {
					content: "跳过下一个摸牌阶段",
				},
				sub: true,
				sourceSkill: "qlyaozhuo",
				_priority: 0,
				skill_id: "qlyaozhuo_skip",
			},
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					if (target.skipList.includes("phaseDraw") || target.hasSkill("pingkou")) {
						return 0;
					}
					var hs = player.getCards("h").sort(function (a, b) {
						return b.number - a.number;
					});
					var ts = target.getCards("h").sort(function (a, b) {
						return b.number - a.number;
					});
					if (!hs.length || !ts.length) {
						return 0;
					}
					if (hs[0].number > ts[0].number - 2 && hs[0].number > 5) {
						return -1;
					}
					return 0;
				},
			},
		},
		_priority: 0,
		skill_id: "qlyaozhuo",
	},
	qlxiaolu: {
		audio: "scsxiaolu",
		enable: "phaseUse",
		usable: 1,
		content() {
			"step 0";
			player.draw(5);
			("step 1");
			var num = player.countCards("h");
			if (!num) {
				event.finish();
			} else if (num < 5) {
				event._result = { index: 1 };
			} else {
				player
					.chooseControl()
					.set("choiceList", ["将五张手牌交给一名其他角色", "弃置五张手牌"])
					.set("ai", function () {
						if (
							game.hasPlayer(function (current) {
								return current != player && get.attitude(player, current) > 0;
							})
						) {
							return 0;
						}
						return 1;
					});
			}
			("step 2");
			if (result.index == 0) {
				player.chooseCardTarget({
					position: "h",
					filterCard: true,
					selectCard: 5,
					filterTarget(card, player, target) {
						return player != target;
					},
					ai1(card) {
						return get.unuseful(card);
					},
					ai2(target) {
						var att = get.attitude(_status.event.player, target);
						if (target.hasSkillTag("nogain")) {
							att /= 10;
						}
						if (target.hasJudge("lebu")) {
							att /= 5;
						}
						return att;
					},
					prompt: "选择五张手牌，交给一名其他角色",
					forced: true,
				});
			} else {
				player.chooseToDiscard(5, true, "h");
				event.finish();
			}
			("step 3");
			if (result.bool) {
				var target = result.targets[0];
				player.give(result.cards, target);
			}
		},
		ai: {
			order: 9,
			result: {
				player: 2,
			},
		},
		_priority: 0,
		skill_id: "qlxiaolu",
	},
	qlchihe: {
		audio: "scschihe",
		trigger: {
			player: "useCardToPlayered",
		},
		filter(event, player) {
			return event.targets.length == 1 && event.card.name == "sha";
		},
		prompt2(event, player) {
			var str = "亮出牌堆顶的四张牌并增加伤害；且";
			str += "令" + get.translation(event.target) + "不能使用";
			str += "这两张牌所包含的花色";
			str += "的牌响应" + get.translation(event.card);
			return str;
		},
		logTarget: "target",
		locked: false,
		check(event, player) {
			var target = event.target;
			if (get.attitude(player, target) > 0) {
				return false;
			}
			return true;
		},
		content() {
			var num = 4;
			var evt = trigger.getParent();
			var suit = get.suit(trigger.card);
			var suits = [];
			if (num > 0) {
				if (typeof evt.baseDamage != "number") {
					evt.baseDamage = 1;
				}
				var cards = get.cards(num);
				player.showCards(cards.slice(0), get.translation(player) + "发动了【叱吓】");
				while (cards.length > 0) {
					var card = cards.pop();
					var suitx = get.suit(card, false);
					suits.add(suitx);
					if (suit == suitx) {
						evt.baseDamage++;
					}
				}
				game.updateRoundNumber();
			}
			evt._qlchihe_player = player;
			var target = trigger.target;
			target.addTempSkill("qlchihe_block");
			if (!target.storage.qlchihe_block) {
				target.storage.qlchihe_block = [];
			}
			target.storage.qlchihe_block.push([evt.card, suits]);
			lib.skill.qlchihe.updateBlocker(target);
		},
		updateBlocker(player) {
			var list = [],
				storage = player.storage.qlchihe_block;
			if (storage && storage.length) {
				for (var i of storage) {
					list.addArray(i[1]);
				}
			}
			player.storage.qlchihe_blocker = list;
		},
		ai: {
			threaten: 2.5,
		},
		subSkill: {
			block: {
				mod: {
					cardEnabled(card, player) {
						if (!player.storage.qlchihe_blocker) {
							return;
						}
						var suit = get.suit(card);
						if (suit == "none" || suit == "unsure") {
							return;
						}
						var evt = _status.event;
						if (evt.name != "chooseToUse") {
							evt = evt.getParent("chooseToUse");
						}
						if (!evt || !evt.respondTo || evt.respondTo[1].name != "sha") {
							return;
						}
						if (player.storage.qlchihe_blocker.includes(suit)) {
							return false;
						}
					},
				},
				trigger: {
					player: ["damageBefore", "damageCancelled", "damageZero"],
					target: ["shaMiss", "useCardToExcluded", "useCardToEnd"],
					global: ["useCardEnd"],
				},
				forced: true,
				firstDo: true,
				charlotte: true,
				popup: false,
				onremove(player) {
					delete player.storage.qlchihe_block;
					delete player.storage.qlchihe_blocker;
				},
				filter(event, player) {
					const evt = event.getParent("useCard", true, true);
					if (evt && evt.effectedCount < evt.effectCount) {
						return false;
					}
					if (!event.card || !player.storage.qlchihe_block) {
						return false;
					}
					for (var i of player.storage.qlchihe_block) {
						if (i[0] == event.card) {
							return true;
						}
					}
					return false;
				},
				content() {
					var storage = player.storage.qlchihe_block;
					for (var i = 0; i < storage.length; i++) {
						if (storage[i][0] == trigger.card) {
							storage.splice(i--, 1);
						}
					}
					if (!storage.length) {
						player.removeSkill("qlchihe_block");
					} else {
						lib.skill.qlchihe.updateBlocker(target);
					}
				},
				sub: true,
				sourceSkill: "qlchihe",
				_priority: 0,
				skill_id: "qlchihe_block",
			},
		},
		_priority: 0,
		skill_id: "qlchihe",
	},
	qlniqu: {
		audio: "scsniqu",
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		selectTarget: [1, 2],
		content() {
			target.damage("fire");
		},
		ai: {
			expose: 0.2,
			order: 5,
			result: {
				target(player, target) {
					return get.damageEffect(target, player, target, "fire") / 10;
				},
			},
		},
		_priority: 0,
		skill_id: "qlniqu",
	},
	qlmiaoyu: {
		audio: "scsanruo",
		enable: ["chooseToUse", "chooseToRespond"],
		prompt: "将至多两张♦牌当作火【杀】，♥牌当作【桃】，♣牌当作【闪】，♠牌当作【无懈可击】使用或打出",
		viewAs(cards, player) {
			var name = false;
			var nature = null;
			switch (get.suit(cards[0], player)) {
				case "club":
					name = "shan";
					break;
				case "diamond":
					name = "sha";
					nature = "fire";
					break;
				case "spade":
					name = "wuxie";
					break;
				case "heart":
					name = "tao";
					break;
			}
			//返回判断结果
			if (name) {
				return { name: name, nature: nature };
			}
			return null;
		},
		check(card) {
			if (ui.selected.cards.length) {
				return 0;
			}
			var player = _status.event.player;
			if (_status.event.type == "phase") {
				var max = 0;
				var name2;
				var list = ["sha", "tao"];
				var map = { sha: "diamond", tao: "heart" };
				for (var i = 0; i < list.length; i++) {
					var name = list[i];
					if (
						player.countCards("hes", function (card) {
							return (name != "sha" || get.value(card) < 5) && get.suit(card, player) == map[name];
						}) > 0 &&
						player.getUseValue({ name: name, nature: name == "sha" ? "fire" : null }) > 0
					) {
						var temp = get.order({ name: name, nature: name == "sha" ? "fire" : null });
						if (temp > max) {
							max = temp;
							name2 = map[name];
						}
					}
				}
				if (name2 == get.suit(card, player)) {
					return name2 == "diamond" ? 5 - get.value(card) : 20 - get.value(card);
				}
				return 0;
			}
			return 1;
		},
		selectCard: [1, 2],
		complexCard: true,
		position: "hes",
		filterCard(card, player, event) {
			if (ui.selected.cards.length) {
				return get.suit(card, player) == get.suit(ui.selected.cards[0], player);
			}
			event = event || _status.event;
			var filter = event._backup.filterCard;
			var name = get.suit(card, player);
			if (name == "club" && filter({ name: "shan", cards: [card] }, player, event)) {
				return true;
			}
			if (name == "diamond" && filter({ name: "sha", cards: [card], nature: "fire" }, player, event)) {
				return true;
			}
			if (name == "spade" && filter({ name: "wuxie", cards: [card] }, player, event)) {
				return true;
			}
			if (name == "heart" && filter({ name: "tao", cards: [card] }, player, event)) {
				return true;
			}
			return false;
		},
		filter(event, player) {
			var filter = event.filterCard;
			if (filter(get.autoViewAs({ name: "sha", nature: "fire" }, "unsure"), player, event) && player.countCards("hes", { suit: "diamond" })) {
				return true;
			}
			if (filter(get.autoViewAs({ name: "shan" }, "unsure"), player, event) && player.countCards("hes", { suit: "club" })) {
				return true;
			}
			if (filter(get.autoViewAs({ name: "tao" }, "unsure"), player, event) && player.countCards("hes", { suit: "heart" })) {
				return true;
			}
			if (filter(get.autoViewAs({ name: "wuxie" }, "unsure"), player, event) && player.countCards("hes", { suit: "spade" })) {
				return true;
			}
			return false;
		},
		precontent() {
			player.addTempSkill("qlmiaoyu_num");
			player.addTempSkill("qlmiaoyu_discard");
		},
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag) {
				var name;
				switch (tag) {
					case "respondSha":
						name = "diamond";
						break;
					case "respondShan":
						name = "club";
						break;
					case "save":
						name = "heart";
						break;
				}
				if (!player.countCards("hes", { suit: name })) {
					return false;
				}
			},
			order(item, player) {
				if (player && _status.event.type == "phase") {
					var max = 0;
					var list = ["sha", "tao"];
					var map = { sha: "diamond", tao: "heart" };
					for (var i = 0; i < list.length; i++) {
						var name = list[i];
						if (
							player.countCards("hes", function (card) {
								return (name != "sha" || get.value(card) < 5) && get.suit(card, player) == map[name];
							}) > 0 &&
							player.getUseValue({
								name: name,
								nature: name == "sha" ? "fire" : null,
							}) > 0
						) {
							var temp = get.order({
								name: name,
								nature: name == "sha" ? "fire" : null,
							});
							if (temp > max) {
								max = temp;
							}
						}
					}
					max /= 1.1;
					return max;
				}
				return 2;
			},
		},
		hiddenCard(player, name) {
			if (name == "wuxie" && _status.connectMode && player.countCards("hs") > 0) {
				return true;
			}
			if (name == "wuxie") {
				return player.countCards("hes", { suit: "spade" }) > 0;
			}
			if (name == "tao") {
				return player.countCards("hes", { suit: "heart" }) > 0;
			}
		},
		subSkill: {
			num: {
				charlotte: true,
				trigger: {
					player: "useCard",
				},
				filter(event) {
					return ["sha", "tao"].includes(event.card.name) && event.skill == "qlmiaoyu" && event.cards && event.cards.length == 2;
				},
				forced: true,
				popup: false,
				content() {
					trigger.baseDamage++;
				},
				sub: true,
				sourceSkill: "qlmiaoyu",
				_priority: 0,
				skill_id: "qlmiaoyu_num",
			},
			discard: {
				charlotte: true,
				trigger: {
					player: ["useCardAfter", "respondAfter"],
				},
				autodelay(event) {
					return event.name == "respond" ? 0.5 : false;
				},
				filter(event, player) {
					return ["shan", "wuxie"].includes(event.card.name) && event.skill == "qlmiaoyu" && event.cards && event.cards.length == 2 && _status.currentPhase && _status.currentPhase != player;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					if (!game.filterPlayer().filter(c => c.countGainableCards(player, c !== player ? "he" : "e") > 0).length) return;
					const result1 = await player
						.chooseTarget("获得一名角色的牌", (c, x, target) => target.countGainableCards(player, target !== player ? "he" : "e") > 0, true)
						.set("ai", target => {
							const player = get.player();
							return get.effect(target, { name: "shunshou_copy", position: "he" }, player, player);
						})
						.forResult();
					if (result1.bool) {
						player.line(result1.targets[0]);
						await player.gainPlayerCard(result1.targets[0], "he", true);
					}
				},
				sub: true,
				sourceSkill: "qlmiaoyu",
				_priority: 0,
				skill_id: "qlmiaoyu_discard",
			},
		},
		_priority: 0,
		skill_id: "qlmiaoyu",
	},
	qlpicai: {
		audio: "scspicai",
		enable: "phaseUse",
		usable: 1,
		frequent: true,
		content() {
			"step 0";
			event.cards = [];
			event.suits = [];
			("step 1");
			player
				.judge(function (result) {
					var evt = _status.event.getParent("qlpicai");
					if (evt && evt.suits && evt.suits.includes(get.suit(result))) {
						return 0;
					}
					event.suits = [];
					return 1;
				})
				.set("callback", lib.skill.scspicai.callback).judge2 = function (result) {
					return result.bool ? true : false;
				};
			("step 2");
			var cards = cards.filterInD();
			if (cards.length) {
				player.chooseTarget("将" + get.translation(cards) + "交给一名角色", true).set("ai", function (target) {
					var player = _status.event.player;
					var att = get.attitude(player, target) / Math.sqrt(1 + target.countCards("h"));
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					return att;
				});
			} else {
				event.finish();
			}
			("step 3");
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.line(target, "green");
				target.gain(cards, "gain2").giver = player;
			} else {
				event.finish();
			}
		},
		callback() {
			"step 0";
			var evt = event.getParent(2);
			event.getParent().orderingCards.remove(event.judgeResult.card);
			evt.cards.push(event.judgeResult.card);
			if (event.getParent().result.bool) {
				evt.suits.push(event.getParent().result.suit);
				player.chooseBool("是否继续发动【庀材】？").set("frequentSkill", "scspicai");
			} else {
				event._result = { bool: false };
			}
			("step 1");
			if (result.bool) {
				event.getParent(2).redo();
			}
		},
		ai: {
			order: 9,
			result: {
				player: 1,
			},
		},
		skill_id: "scspicai",
	},
	qlhuoxin: {
		enable: "phaseUse",
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			const targets = [];
			event.player.getHistory("useSkill", evt => {
				if (evt.skill != "qlhuoxin" || !evt.targets?.length) {
					return false;
				}
				targets.addArray(evt.targets);
			});
			event.set("qlhuoxin_targets", targets);
		},
		filter(event, player) {
			const { filterCard, filterTarget } = get.info("qlhuoxin");
			return player.countCards("he", card => filterCard(card, player)) && game.hasPlayer(current => filterTarget(null, player, current));
		},
		filterCard(card, player) {
			return !player.getStorage("qlhuoxin_used").includes(get.suit(card));
		},
		position: "he",
		check(card) {
			return 9 - get.value(card);
		},
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			const { qlhuoxin_targets } = get.event();
			return !qlhuoxin_targets.includes(target);
		},
		lose: false,
		discard: false,
		async content(event, trigger, player) {
			const { cards, target, name } = event;
			await player.give(cards, target);
			const preSuits = cards.map(card => get.suit(card)).toUniqued(),
				skill = "qlhuoxin_used";
			player.addTempSkill(skill);
			player.markAuto(skill, preSuits);
			player.addTip(
				skill,
				`${get.translation(name)}${player
					.getStorage(skill)
					.map(suit => get.translation(suit))
					.join("")}`
			);
			const suits = target
				.getGainableCards(player, "hej")
				.map(card => get.suit(card))
				.toUniqued()
				.removeArray(preSuits);
			if (suits.length > 0) {
				await player
					.gainPlayerCard(target, "hej", true, suits.length, "visible")
					.set("filterButton", button => {
						const { preCards } = get.event(),
							suit = get.suit(button.link);
						if (preCards.some(card => get.suit(card) == suit)) {
							return false;
						}
						return ui.selected.buttons.every(buttonx => get.suit(buttonx.link) != suit);
					})
					.set("complexSelect", true)
					.set("preCards", cards)
					.forResult();
			}
			let gain = 0;
			player.getHistory("gain", evt => {
				if (evt.getParent(2) == event && evt.cards?.length) {
					gain += evt.cards.length;
				}
			});
			switch (gain) {
				case 0: {
					await player.draw(3);
					break;
				}
				case 1: {
					const result = await player
						.chooseControl("回复1点体力", "失去1点体力")
						.set("prompt", `${get.translation(name)}：选择一项令${get.translation(target)}执行`)
						.set("ai", () => get.event().resultx)
						.set(
							"resulx",
							(() => {
								const eff1 = get.effect(target, { name: "losehp" }, player, player),
									eff2 = get.recoverEffect(target, player, player);
								if (eff1 > eff2) {
									return 1;
								}
								return 0;
							})()
						)
						.forResult();
					player.line(target, "green");
					await target[["recover", "loseHp"][result.index]]();
					break;
				}
				case 2: {
					if (player.countCards("he", lib.filter.cardRecastable)) {
						const result = await player
							.chooseCard(`${get.translation(name)}：重铸任意张牌`, [1, Infinity], lib.filter.cardRecastable, "he", true, "allowChooseAll")
							.set("ai", card => {
								return 6 - get.value(card);
							})
							.forResult();
						if (result?.bool) {
							await player.recast(result.cards);
						}
					}
					break;
				}
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (!target.countCards("hej")) {
						return 1;
					}
					return -2;
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove(player, skill) {
					player.removeTip(skill);
					player.setStorage(skill, []);
				},
			},
		},
	},
	qlleguose: {
		mark: true,
		marktext: "乐",
		intro: {
			name2: "国色",
			content: "mark",
		},
		global: "qlleguose_distance",
		mod: {
			targetInRange(card, player, target) {
				if (target.hasMark("qlleguose")) {
					return true;
				}
			},
			cardUsableTarget(card, player, target) {
				if (target.hasMark("qlleguose")) {
					return true;
				}
			},
		},
		trigger: {
			player: "useCardToTargeted",
		},
		forced: true,
		locked: false,
		direct: true,
		filter(event, player) {
			return event.isFirstTarget && event.targets.length == 1 && event.target.hasMark("qlleguose") && (get.type(event.card) == "basic" || get.type(event.card) == "trick");
		},
		async content(event, trigger, player) {
			const num = trigger.target.countMark("qlleguose");
			await player.draw(num);
			trigger.getParent().effectCount += num;
			trigger.getParent().baseDamage += num;
		},
		group: ["qlleguose_start", "qlleguose_dying", "qlleguose_die"],
		subSkill: {
			distance: {
				mod: {
					globalTo(from, to, distance) {
						return distance + to.countMark("qlleguose");
					},
					targetEnabled(card, player, target, now) {
						if (card.name == "lebu" && target.hasMark("qlleguose")) {
							return false;
						}
					},
				},
				skill_id: "qlleguose_distance",
				sub: true,
				sourceSkill: "qlleguose",
				_priority: 0,
			},
			start: {
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				forced: true,
				locked: false,
				direct: true,
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				async content(event, trigger, player) {
					await player.addMark("qlleguose", 4, true);
				},
				skill_id: "qlleguose_start",
				sub: true,
				sourceSkill: "qlleguose",
				_priority: 0,
			},
			dying: {
				trigger: {
					global: "dying",
				},
				forced: true,
				locked: false,
				direct: true,
				filter: function (event, player) {
					return event.player.hasMark("qlleguose");
				},
				async content(event, trigger, player) {
					await player.gainMaxHp();
					await player.recover();
				},
				skill_id: "qlleguose_dying",
				sub: true,
				sourceSkill: "qlleguose",
				_priority: 0,
			},
			die: {
				trigger: {
					global: "die",
				},
				forced: true,
				locked: false,
				direct: true,
				filter: function (event, player) {
					return event.player.hasMark("qlleguose");
				},
				async content(event, trigger, player) {
					const num2 = trigger.player.countMark("qlleguose");
					await player.addMark("qlleguose", num2);
				},
				skill_id: "qlleguose_die",
				sub: true,
				sourceSkill: "qlleguose",
				_priority: 0,
			},
		},
		skill_id: "qlleguose",
	},
	qlliuli: {
		trigger: {
			player: ["phaseZhunbeiBegin", "phaseJieshuBegin"],
		},
		filter: function (event, player) {
			return player.hasMark("qlleguose");
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseTarget()
				.set("filterTarget", function (player, target) {
					return target != player;
				})
				.forResult();
			if (result.bool) {
				await player.removeMark("qlleguose", 1);
				await result.targets[0].addMark("qlleguose", 1);
			}
		},
		skill_id: "qlliuli",
		_priority: 0,
	},
	qlqingleng: {
		persevereSkill: true,
		superCharlotte: true,
		group: ["qlqingleng_judge", "qlqingleng_start"],
		subSkill: {
			judge: {
				trigger: {
					player: "judgeFixing",
				},
				persevereSkill: true,
				superCharlotte: true,
				usable: 1,
				filter(event, player) {
					return event.result;
				},
				check(event, player) {
					return event.result.judge * get.attitude(player, event.player) <= 0;
				},
				content() {
					var evt = trigger.getParent();
					if (evt.name == "phaseJudge") {
						evt.excluded = true;
					} else {
						evt.finish();
						evt._triggered = null;
						if (evt.name.startsWith("pre_")) {
							var evtx = evt.getParent();
							evtx.finish();
							evtx._triggered = null;
						}
						var nexts = trigger.next.slice();
						for (var next of nexts) {
							if (next.name == "judgeCallback") {
								trigger.next.remove(next);
							}
						}
						var evts = game.getGlobalHistory("cardMove", function (evt) {
							return evt.getParent(2) == trigger.getParent();
						});
					}
				},
				skill_id: "qlqingleng_judge",
				sub: true,
				sourceSkill: "qlqingleng",
				_priority: 0,
			},
			start: {
				trigger: {
					global: "gameStart",
				},
				forced: true,
				persevereSkill: true,
				superCharlotte: true,
				content: function () {
					player.addSkills(["qinyin", "jdjuqi", "zishu", "dchuace"]);
				},
				popup: false,
				skill_id: "qlqingleng_start",
				sub: true,
				sourceSkill: "qlqingleng",
				_priority: 0,
			},
		},
		skill_id: "qlqingleng",
		_priority: 0,
	},
	qlaige: {
		trigger: {
			global: "damageEnd",
		},
		filter(event, player) {
			return player.getStorage("qlaige").length < 6;
		},
		persevereSkill: true,
		superCharlotte: true,
		fixed: true,
		onremove: true,
		async cost(event, trigger, player) {
			if (trigger.player != player) {
				const controls = get.skillInfoTranslation(event.skill, player).slice(0, -1).split("：")[1].split("；");
				const result = await player
					.chooseButton([
						get.prompt(event.skill),
						[
							controls.map(control => {
								return control.split(".");
							}),
							"textbutton",
						],
					])
					.set("filterButton", button => {
						const player = get.player(),
							list = player.getStorage("qlaige"),
							trigger = get.event().getTrigger();
						if (list.includes(button.link)) {
							return false;
						}
						const target = "123".includes(button.link) ? trigger.player : trigger.source;
						return target?.isIn();
					})
					.set("ai", button => {
						return Math.random();
					})
					.forResult();
				if (result?.bool && result.links?.length) {
					event.result = {
						bool: true,
						cost_data: result.links[0],
					};
				}
			} else {
				const result = await player.judge().forResult();
				event.result = {
					bool: true,
					cost_data: result,
				};
			}
		},
		async content(event, trigger, player) {
			if (trigger.player == player) {
				const result = event.cost_data;
				const card = result.card;
				const suit = get.suit(result.card);
				switch (suit) {
					case "heart":
						player.recover(trigger.num);
						break;
					case "diamond":
						player.draw(3);
						break;
					case "club":
						trigger.source.chooseToDiscard("he", 2, true);
						break;
					case "spade":
						trigger.source.turnOver();
						break;
				}
			} else {
				const { cost_data: link, name } = event;
				player.markAuto(name, link);
				await event.trigger("qlaigeRemove");
				const target = "123".includes(link) ? trigger.player : trigger.source;
				const func = get.info(name)[`content${link}`];
				if (typeof func == "function") {
					player.line(target, "green");
					await func(target, player);
				}
			}
		},
		async content1(target, player) {
			await target.gainMaxHp();
			await target.recoverTo(target.maxHp);
		},
		async content2(target, player) {
			await target.draw(8);
		},
		async content3(target, player) {
			await target.addTempSkill("qlaige_imm", { target: "phaseBegin" });
		},
		async content4(target, player) {
			var cards = target.getCards("hes");
			target.discard(cards);
		},
		async content5(target, player) {
			await target.loseHp(target.hp - 1);
		},
		async content6(target, player) {
			target.addTempSkill("fengyin");
		},
		subSkill: {
			imm: {
				trigger: {
					player: "damageBegin4",
				},
				locked: true,
				persevereSkill: true,
				async content(event, trigger, player) {
					trigger.num = 0;
					trigger.cancel();
				},
			},
		},
	},
	qlduanqu: {
		trigger: {
			player: ["enterGame", "qlaigeRemove", "dieBegin", "gainMaxHpBefore", "loseMaxHpBefore"],
			global: "phaseBefore",
		},
		locked: true,
		persevereSkill: true,
		superCharlotte: true,
		fixed: true,
		filter(event, player) {
			if (event.name.indexOf("MaxHp") !== -1) {
				return event.getParent().name !== "qlduanqu";
			}
			if (event.name == "die") {
				return player.getStorage("qlaige").length < 6 || event.source?.isIn();
			}
			if (event.name == "phase" && game.phaseNumber !== 0) {
				return false;
			}
			return player.maxHp !== 7 - player.getStorage("qlaige").length;
		},
		async cost(event, trigger, player) {
			if (trigger.name == "die" && player.getStorage("qlaige").length < 6) {
				const controls = get.skillInfoTranslation("qlaige", player).slice(0, -1).split("：")[1].split("；");
				const result = await player
					.chooseButton(
						[
							"断曲：移去【哀歌】的一项并防止死亡",
							[
								controls.map(control => {
									return control.split(".");
								}),
								"textbutton",
							],
						],
						true
					)
					.set("filterButton", button => {
						const player = get.player(),
							list = player.getStorage("qlaige"),
							trigger = get.event().getTrigger();
						if (list.includes(button.link)) {
							return false;
						}
						return true;
					})
					.set("ai", button => {
						return Math.random();
					})
					.forResult();
				if (result?.bool && result.links?.length) {
					event.result = {
						bool: true,
						cost_data: result.links[0],
					};
				}
			} else {
				event.result = {
					bool: true,
				};
				if (trigger.name == "die") {
					event.result.targets = [trigger.source];
				}
			}
		},
		async content(event, trigger, player) {
			if (trigger.name.indexOf("MaxHp") !== -1) {
				trigger.cancel();
				return;
			}
			if (trigger.name == "die") {
				if (typeof event.cost_data == "string") {

					player.markAuto("qlaige", event.cost_data);
					await event.trigger("qlaigeRemove");
					await player.changeHp(4444);
					if (player.getHp() > 0) {
						trigger.cancel();
					}
				} else if (event.targets?.length) {
					const target = event.targets[0];
					if (target?.isIn()) {
						await target.getSkills(true, false, false).forEach(skill => {
							if (!get.info(skill).qiuli) target.removeSkill(skill, true);
						})
						//await target.removeSkills(target.getStockSkills(false, true));
					}
				}
				return;
			}
			const num = player.maxHp - 7 + player.getStorage("qlaige").length;
			if (num > 0) {
				await player.loseMaxHp(num);
			} else if (num < 0) {
				await player.gainMaxHp(-num);
			}
		},
	},
	qltiaoxin: {
		audio: "retiaoxin",
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + (player.hasSkill(skill + "_rewrite", null, null, false) ? 1 : 0);
		},
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.qltiaoxin.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await target
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"挑衅：对" + get.translation(player) + "使用一张杀，或令其弃置你的一张牌"
				)
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("complexTarget", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.filterTarget.apply(this, arguments);
				})
				.set("sourcex", player).forResult();
			if (
				!result.bool ||
				!player.hasHistory("damage", evt => {
					return evt.getParent().type == "card" && evt.getParent(4) == event;
				})
			) {
				if (target.countDiscardableCards(player, "he") > 0) {
					await player.discardPlayerCard(target, "he", true).set("boolline", true);
					await player.draw();
				}
			}
		},
		ai: {
			order: 4,
			expose: 0.2,
			result: {
				target: -1,
				player(player, target) {
					if (target.countCards("h") == 0) {
						return 0;
					}
					if (target.countCards("h") == 1) {
						return -0.1;
					}
					if (player.hp <= 2) {
						return -2;
					}
					if (player.countCards("h", "shan") == 0) {
						return -1;
					}
					return -0.5;
				},
			},
			threaten: 1.1,
		},
		skill_id: "qltiaoxin",
	},
	qlchengzhi: {
		skillAnimation: true,
		animationColor: "fire",
		audio: "olsbranji",
		audioname: ["re_jiangwei"],
		juexingji: true,
		derivation: "qlwanju",
		trigger: {
			player: ["phaseBegin", "dieBegin"],
		},
		forced: true,
		filter(event, player) {
			if (player.storage.qlchengzhi) {
				return false;
			}
			return player.countCards("h") <= 2 && player.hp <= 2 && player.hujia <= 2;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			if (player.hp <= 2) {
				if (player.hp <= 0) {
					trigger.cancel();
				}
				player.recoverTo(2);
			}
			await player.addSkills("qlwanju");
		},
		skill_id: "qlchengzhi",
		_priority: 0,
	},
	qlwanju: {
		trigger: {
			global: "phaseZhunbeiBegin",
		},
		audio: "tianren",
		locked: true,
		forced: true,
		filter(event, player) {
			return player.countCards("h") <= 2 || player.hp <= 2 || player.hujia <= 2;
		},
		async content(event, trigger, player) {
			await player.chooseToGuanxing(5);
			const { cards: result } = await player.draw(2).forResult();
			if (result) {
				var color = get.color(result[0], player);
				for (var i = 1; i < result.length; i++) {
					if (get.color(result[i], player) != color) {
						await player.changeHujia(true);
					} else {
						await player.recover();
					}
				}
			}
		},
		skill_id: "qlwanju",
		_priority: 0,
	},
	qlxuezao: {
		init(player, skill) {
			player.setStorage(skill, ["yang", "yin"]);
		},
		onremove: true,
		trigger: {
			player: "useCard",
		},
		forced: true,
		mark: true,
		marktext: "☯",
		zhuanhuanji(player, skill) {
			player.setStorage(skill, player.getStorage(skill).reverse());
		},
		intro: {
			markcount(_1, player, skill) {
				const list = player.getStorage(skill);
				if (list?.length && list[0] === "yin") {
					return "阴";
				}
				return "阳";
			},
			content(_1, player, skill) {
				const list = player.getStorage(skill);
				if (list?.length && list[0] === "yin") {
					return "锁定技，转换技，你于出牌阶段内使用牌时，回复1点体力，然后将手牌弃至体力值（未以此法失去牌则弃置两张牌）。";
				}
				return "锁定技，转换技，你于出牌阶段内使用牌时，失去1点体力，然后将手牌摸至体力值（未以此法获得牌则摸两张牌）。";
			},
		},
		filter(event, player) {
			return player.isPhaseUsing();
		},
		async content(event, trigger, player) {
			const list = player.getStorage(event.name).slice(0);
			player.changeZhuanhuanji(event.name);
			if (list?.length && list[0] === "yin") {
				await player.recover();
				const num = Math.max(0, player.countDiscardableCards(player, "h") - player.getHp());
				if (num > 0) {
					await player.chooseToDiscard("h", num, true);
				}
				if (!player.hasHistory("lose", evt => evt.getParent(3) === event)) {
					const numx = Math.min(2, player.countDiscardableCards(player, "he"));
					if (numx > 0) {
						await player.chooseToDiscard("he", numx, true);
					}
				}
			} else {
				await player.loseHp();
				const num = Math.max(0, player.getHp() - player.countCards("h"));
				if (num > 0) {
					await player.draw(num);
				}
				if (!player.hasHistory("gain", evt => evt.getParent(2) === event)) {
					await player.draw(2);
				}
			}
		},
	},
	qlxiaozhen: {
		enable: "phaseUse",
		sunbenSkill: true,
		filter(event, player) {
			if (!player.hasSkill("qlxuezao", null, null, false)) {
				return false;
			}
			const list = player.getStorage("qlxuezao");
			return list?.length > 1 || player.countDiscardableCards(player, "he");
		},
		filterCard(card, player) {
			const list = player.getStorage("qlxuezao");
			if (list?.length > 1) {
				return false;
			}
			return lib.filter.cardDiscardable(card, player, "qlxiaozhen");
		},
		selectCard() {
			const player = get.player(),
				list = player.getStorage("qlxuezao");
			if (list?.length > 1) {
				return -1;
			}
			return 1;
		},
		prompt() {
			const player = get.player(),
				list = player.getStorage("qlxuezao");
			if (list?.length > 1) {
				return "昂扬技，出牌阶段，你可摸一张牌并令你本回合使用的下一张牌无次数限制且不计入次数限制，然后移去〖血躁〗的一项直到本回合结束。激昂：使用一张牌。";
			}
			return "昂扬技，出牌阶段，你可弃置一张牌并令你本回合使用的下一张牌无次数限制且不计入次数限制，然后恢复〖血躁〗的一项。激昂：使用一张牌。";
		},
		manualConfirm: true,
		position: "he",
		async content(event, trigger, player) {
			const name = event.name;
			player.awakenSkill(name);
			player.when("useCard").step(async (event, trigger, player) => {
				if (!player.hasSkill(name) && player.hasSkill(name, null, null, false)) {
					player.popup(get.translation(name));
					player.restoreSkill(name);
					game.log(player, "恢复了技能", `#g【${get.translation(name)}】`);
				}
			});
			const list = player.getStorage("qlxuezao"),
				map = {
					yang: "<span class='firetext'>阳</span>",
					yin: "<span class='bluetext'>阴</span>",
				};
			if (list.length > 1) {
				await player.draw();
			}
			player.addTip(name, "骁阵 不计次数");
			const { skill } = player
				.when({
					global: ["phaseBegin", "phaseAfter"],
					player: "useCard",
				})
				.assign({
					mod: {
						cardUsable: () => Infinity,
					},
				})
				.step(async (event, trigger, player) => {
					player.removeTip(name);
					if (trigger.name == "phase") {
						return;
					}
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] === "number" && stat[name] > 0) {
							stat[name]--;
						}
						game.log(trigger.card, "不计入次数");
					}
				});
			game.broadcast(name => {
				lib.skill[name].mod = {
					cardUsable: () => Infinity,
				};
			}, skill);
			if (list.length > 1) {
				const result = await player
					.chooseButton(
						[
							"骁阵：选择删去【血躁】的一个分支",
							[
								[
									["yang", "<span class='firetext'>锁定技，转换技，你于出牌阶段内使用牌时，失去1点体力，然后将手牌摸至体力值（未以此法获得牌则摸两张牌）。</span>"],
									["yin", "<span class='bluetext'>锁定技，转换技，你于出牌阶段内使用牌时，回复1点体力，然后将手牌弃至体力值（未以此法失去牌则弃置两张牌）。</span>"],
								],
								"textbutton",
							],
						],
						true
					)
					.set("ai", () => Math.random())
					.forResult();
				if (result?.bool && result.links?.length) {
					game.log(player, "删去了", "#g【血躁】", `的${map[result.links[0]]}分支`);
					player.setStorage("qlxuezao", list.removeArray(result.links), true);
					player
						.when({
							global: "phaseAfter",
						})
						.step(async (event, trigger, player) => {
							const types = player.getStorage("qlxuezao"),
								adds = ["yang", "yin"].removeArray(types);
							if (adds?.length) {
								game.log(player, "恢复了", "#g【血躁】", `的${map[adds[0]]}分支`);
								player.setStorage("qlxuezao", types.addArray(adds), true);
							}
						});
				}
				return;
			}
			const adds = ["yang", "yin"].removeArray(list);
			if (adds?.length) {
				game.log(player, "恢复了", "#g【血躁】", `的${map[adds[0]]}分支`);
				player.setStorage("qlxuezao", list.addArray(adds), true);
			}
		},
	},
	qlnusu: {
		enable: "chooseToUse",
		filter(event, player) {
			const hs = player.getCards("hs", card => get.type2(card) == "trick");
			return (
				hs.length > 0 &&
				get.inpileVCardList(info => {
					if (info[0] !== "basic") {
						return false;
					}
					return hs.some(card => {
						const vcard = get.autoViewAs({ name: info[2], nature: info[3] }, [card]);
						return event.filterCard?.(vcard, player, event);
					});
				}).length > 0
			);
		},
		chooseButton: {
			dialog(event, player) {
				const hs = player.getCards("hs", card => get.type2(card) == "trick");
				const list = get.inpileVCardList(info => {
					if (info[0] !== "basic") {
						return false;
					}
					return hs.some(card => {
						const vcard = get.autoViewAs({ name: info[2], nature: info[3] }, [card]);
						return event.filterCard(vcard, player, event);
					});
				});
				const dialog = ui.create.dialog("怒肃", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				const player = get.player(),
					card = get.autoViewAs({ name: button.link[2], nature: button.link[3] }, "unsure");
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					position: "hs",
					filterCard(card, player) {
						return get.type2(card) == "trick";
					},
					async precontent(event, trigger, player) {
						event.result.skill = "qlnusu";
					},
				};
			},
			prompt(links, player) {
				return "将一张锦囊牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		hiddenCard(player, name) {
			if (get.type(name) != "basic") {
				return false;
			}
			return player.countCards("hs", card => get.type2(card) == "trick");
		},
		mod: {
			cardEnabled(card, player) {
				if (get.type(card) == "basic") {
					return;
				}
				const hs = player.getCards("hs", card => get.type2(card) == "trick");
				if (Array.isArray(card.cards) && card.cards.containsSome(...hs)) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (get.type(card) == "basic") {
					return;
				}
				const hs = player.getCards("hs", card => get.type2(card) == "trick");
				if (Array.isArray(card.cards) && card.cards.containsSome(...hs)) {
					return false;
				}
			},
		},
		ai: {
			order: 2,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
	},
	qljiangshi: {
		trigger: {
			global: "roundStart",
		},
		forced: true,
		onremove(player, skill) {
			if (player.getStorage("qljiangshi_character", false)) {
				lib.skill.qljiangshi.characterList.add(player.getStorage("qljiangshi_character", false));
				player.setStorage("qljiangshi_character", false);
			}
		},
		intro: {
			onunmark(storage, player) {
				if (player.getStorage("qljiangshi_character", false)) {
					lib.skill.qljiangshi.characterList.add(player.getStorage("qljiangshi_character", false));
					player.setStorage("qljiangshi_character", false);
				}
			},
			mark(dialog, storage, player) {
				if (player.getStorage("qljiangshi_character", false)) {
					dialog.addText("当前选择的武将牌");
					dialog.add([player.getStorage("qljiangshi_character", false), "character"]);
				} else {
					return "暂未选择武将牌";
				}
			},
		},
		async content(event, trigger, player) {
			if (player.getStorage("qljiangshi_character", false)) {
				lib.skill.qljiangshi.characterList.add(player.getStorage("qljiangshi_character", false));
				player.setStorage("qljiangshi_character", false);
			}
			await player.removeAdditionalSkills("qljiangshi");
			const characterList = lib.skill.qljiangshi.characterList.slice().filter(i => get.character(i)?.skills?.length);
			if (!characterList.length) {
				game.log("但是，武将池没有武将牌了！");
				return;
			}
			const result = await player.chooseButton(["降世：选择一张武将牌", [characterList, "character"]], true).forResult();
			let link = characterList.randomGet();
			if (result && result.links) {
				link = result.links.slice()[0];
			}
			lib.skill.qljiangshi.characterList.remove(link);
			player.setStorage("qljiangshi_character", link);
			const skills = get.character(link).skills;
			await player.addAdditionalSkills("qljiangshi", skills);
			await player.gainMaxHp();
			await player.recover();
		},
		//↓武将池数组
		characterList: ["ql_wuxing", "qlfuronglu", "qlbaishi", "qlsilong", "qldanao", "qltuma", "qlyaya", "qlbianzhong", "qlshierhua", "qlqianli", "qlligui"],
	},
	qiluozai: {
		trigger: { source: "dieAfter" },
		forced: true,
		filter(event, player) {
			return player.getRemovableAdditionalSkills("qljiangshi").length;
		},
		async content(event, trigger, player) {
			player.setStorage("qljiangshi_character", false);
			const skills = player.getRemovableAdditionalSkills("qljiangshi");
			await player.addSkills(skills);
			await player.removeAdditionalSkills("qljiangshi");
			const next = game.createEvent("qljiangshi", false);
			next.player = player;
			next.setContent(lib.skill.qljiangshi.content);
			await next;
		},
	},
	//五星出东方
	qllianzhu: {
		trigger: {
			global: "phaseUseEnd",
		},
		filter(event, player) {
			const cards = player.getCards("s", card => card.hasGaintag("qlwuxing"));
			return (
				cards.length < 5 ||
				cards.some(card => player.hasUseTarget(card, false, false) || (get.info(card).notarget && lib.filter.cardEnabled(card, player)))
			)
		},
		async cost(event, trigger, player) {
			const cards = player.getCards("s", card => card.hasGaintag("qlwuxing"));
			const bool1 = cards.length < 5;
			const bool2 = cards.some(card => player.hasUseTarget(card, false, false) || (get.info(card).notarget && lib.filter.cardEnabled(card, player)));
			const num = Math.ceil((5 - cards.length) / 2);
			let result;
			if (bool1 && bool2) {
				result = await player
					.chooseControl("cancel2")
					.set("choiceList", [
						`用一张无距离限制且伤害+1的"星"`,
						`摸${num}张牌并将至多三张牌置为"星"`
					])
					.set("choice", (() => {
						if (cards.some(card => get.is.damageCard(card))) {
							return 0;
						}
						return 1;
					})())
					.set("prompt", get.prompt2(event.skill))
					.forResult();
			} else if (!bool2) {
				const result2 = await player.chooseBool(get.prompt(event.skill), `摸${num}张牌并将至多三张牌置为"星"`).set("choice", true).forResult();
				if (result2.bool) {
					result = { index: 1 };
				}
			} else if (!bool1) {
				const result2 = await player.chooseBool(get.prompt(event.skill), `用一张无距离限制且伤害+1的"星"`).set("choice", true).forResult();
				if (result2.bool) {
					result = { index: 0 };
				}
			}
			if (result && typeof result.index == "number") {
				event.result = {
					bool: true,
					cost_data: result.index
				}
			}
		},
		async content(event, trigger, player) {
			const { cost_data: index } = event;
			const cards = player.getCards("s", card => card.hasGaintag("qlwuxing"));
			if (index == 0) {
				await player
					.chooseToUse(`连珠：用一张无距离限制且伤害+1的"星"`, true)
					.set("filterCard", function (card) {
						if (get.itemtype(card) != "card" || !card.hasGaintag("qlwuxing")) {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					})
					.set("filterTarget", function (card, player, target) {
						return lib.filter.targetEnabled.call(this, card, player, target);
					})
					.set("oncard", () => {
						const { card, player } = get.event();
						if (get.is.damageCard(card)) {
							get.event().baseDamage++;
						}
						player
							.when("useCardAfter")
							.filter(evt => evt.card == card)
							.then(async (event, trigger, player) => {
								const num = game.filterPlayer2(() => true, void 0, true).reduce((sum, target) => {
									return sum + target.getHistory("damage", evt => {
										return evt.card == trigger.card;
									}).reduce((sum, evt) => sum + evt.num, 0);
								}, 0);
								if (num > 0) {
									await player.draw(num);
								}
							})
					})
					.set("position", "s")
					.forResult();
			} else {
				const num = Math.ceil((5 - cards.length) / 2);
				await player.draw(num);
				const result = await player
					.chooseCard("是否将至多三张牌加入“星”", "he", [1, 5 - cards.length])
					.forResult();
				if (result.bool && result.cards?.length) {
					const { cards } = result;
					game.log(player, "将", cards, "置于了武将牌上");
					await player.loseToSpecial(cards, "qlwuxing").set("visible", true);
					player.markSkill("qlwuxing");
				}
			}
		},
	},
	qlfentian: {
		enable: "phaseUse",
		skillAnimation: true,
		limited: true,
		animationColor: "orange",
		selectCard: 4,
		filter(event, player) {
			return player.countCards("s", card => card.hasGaintag("qlwuxing")) >= 4;
		},
		filterCard(card, player) {
			return card.hasGaintag("qlwuxing");
		},
		filterTarget: true,
		position: "s",
		async content(event, trigger, player) {
			player.awakenSkill(event.name)
			const { cards, target } = event;
			await player.loseToDiscardpile(cards)
			const next = target.damage(2);
			let obj;
			if (game.openZhizhi()) {
				player.addSkill(`${event.name}_draw`);
				player.markAuto(`${event.name}_draw`, target);
			} else {
				obj = player
					.when({ global: "dying" })
					.filter(evt => evt.player == target && evt.reason == next)
					.then(async (event, trigger, player) => {
						await player.draw(3);
					})
			}
			await next;
			if (obj) {
				player.removeSkill(obj.skill);
			}
		},
		subSkill: {
			draw: {
				trigger: {
					global: "dying",
				},
				filter(event, player) {
					return player.getStorage("qlfentian_draw").includes(event.player);
				},
				async content(event, trigger, player) {
					await player.draw(3);
				},
				forced: true,
				onremove: true,
				intro: {
					content: "$进入濒死状态你摸三张牌",
				}
			},
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					return -get.damageEffect(target, player, player);
				}
			}
		}
	},
	qlwuxing: {
		mod: {
			aiOrder(player, card, num) {
				const cards = player.getCards("s", card => card.hasGaintag("qlwuxing"));
				if (get.itemtype(card) == "card" && card.hasGaintag("qlwuxing")) {
					return num + (cards.length > 1 ? 0.5 : -0.0001);
				}
			},
		},
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		locked: true,
		async content(event, trigger, player) {
			await player.draw(5);
			const result = await player.chooseCard("五星：将五张置于武将牌上", 5, true).forResult();
			if (result.cards) {
				const cards2 = result.cards;
				player.$gain2(cards2, false);
				game.log(player, "将", cards2, "置于了武将牌上");
				await player.loseToSpecial(cards2, "qlwuxing").set("visible", true);
				player.markSkill("qlwuxing");
			}
		},
		marktext: "星",
		intro: {
			name: "五星（星）",
			mark(dialog, storage, player) {
				const cards = player.getCards("s", card => card.hasGaintag("qlwuxing"));
				if (!cards || !cards.length) {
					return;
				}
				dialog.addAuto(cards);
			},
			markcount(storage, player) {
				return player.countCards("s", card => card.hasGaintag("qlwuxing"));
			},
			onunmark(storage, player) {
				const cards = player.getCards("s", card => card.hasGaintag("qlwuxing"));
				if (cards.length) {
					player.loseToDiscardpile(cards);
				}
			},
		},
		init(player, skill) {
			player.addSkill(skill + "_unmark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_unmark");
		},
		subSkill: {
			unmark: {
				trigger: {
					player: "loseAfter",
				},
				filter(event, player) {
					if (!event.ss || !event.ss.length) {
						return false;
					}
					return !player.countCards("s", card => card.hasGaintag("qlwuxing"));
				},
				charlotte: true,
				silent: true,
				async content(event, trigger, player) {
					player.unmarkSkill("qlwuxing");
				},
			},
		},
	},
	//羊祜
	qlrongchu: {
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		forced: true,
		filter: function (event, player) {
			const evt = event.getl(player);
			if (!evt?.hs?.length) {
				return false;
			}
			if (event.name == "lose") {
				for (let i in event.gaintag_map) {
					if (event.gaintag_map[i].includes("qlrongchu_tag")) {
						return true;
					}
				}
				return false;
			}
			return player.hasHistory("lose", evt => {
				if (event != evt.getParent()) {
					return false;
				}
				for (let i in evt.gaintag_map) {
					if (evt.gaintag_map[i].includes("qlrongchu_tag")) {
						return true;
					}
				}
				return false;
			});
		},
		async content(event, trigger, player) {
			let subTypes = [];
			if (trigger.name == "lose") {
				for (let i in trigger.gaintag_map) {
					if (trigger.gaintag_map[i].includes("qlrongchu_tag")) {
						for (let tag of trigger.gaintag_map[i]) {
							if (tag.startsWith("qlrongchu_equip")) {
								subTypes.push(tag.slice(10));
							}
						}
					}
				}
			} else {
				player.getHistory("lose", evt => {
					if (trigger != evt.getParent()) {
						return false;
					}
					for (let i in evt.gaintag_map) {
						if (evt.gaintag_map[i].includes("qlrongchu_tag")) {
							for (let tag of evt.gaintag_map[i]) {
								if (tag.startsWith("qlrongchu_equip")) {
									subTypes.push(tag.slice(10));
								}
							}
						}
					}
					return false;
				});
			}
			if (subTypes.length) {
				let cards = [];
				for (let type of subTypes) {
					const card = get.cardPile(card => get.subtype(card) == type && !cards.includes(card));
					if (card) {
						cards.add(card);
					}
					player.addSkill("qlrongchu_" + type + "skill");
				}
				if (cards.length) {
					await player.gain(cards, "gain2");
				}
			}
		},
		group: ["qlrongchu_init"],
		subSkill: {
			tag: { name: "invisible" },
			equip1: { name: "武器" },
			equip2: { name: "防具" },
			equip3: { name: "防御坐骑" },
			equip4: { name: "进攻坐骑" },
			equip5: { name: "宝物" },
			init: {
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				audio: "qlrongchu",
				forced: true,
				filter: function (event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				async content(event, trigger, player) {
					await player.drawTo(5);
					let cards = player.getCards("h").randomGets(5);
					if (!cards.length) return;
					for (let i = 1; i <= 5; i++) {
						const card = cards.randomRemove(1);
						player.addGaintag(card, "qlrongchu_tag");
						player.addGaintag(card, "qlrongchu_equip" + i);
						if (!cards.length) break;
					}
				},
			},
			equip1skill: {
				mod: {
					attackFrom(from, to, distance) {
						return distance - (5 - from.countCards("h", card => card.hasGaintag("qlrongchu_tag")));
					},
				},
			},
			equip2skill: {
				trigger: {
					target: "useCardToTargeted",
				},
				usable(skill, player) {
					return 5 - player.countCards("h", card => card.hasGaintag("qlrongchu_tag"));
				},
				async content(event, trigger, player) {
					if (get.color(trigger.card) == "red") {
						await player.draw();
					} else {
						await player.discardPlayerCard(trigger.player, "hej");
					}
				},
			},
			equip3skill: {
				trigger: {
					player: "gainAfter",
				},
				usable(skill, player) {
					return 5 - player.countCards("h", card => card.hasGaintag("qlrongchu_tag"));
				},
				forced: true,
				filter(event, player) {
					return event.getParent().name == "draw" && event.getParent(2).name != "qlrongchu_equip3skill" && event.getParent("phaseDraw").player != player;
				},
				content() {
					"step 0";
					player.chooseTarget(true, "请选择【戎储】的目标", "令一名角色摸一张牌").set("ai", function (target) {
						return get.attitude(_status.event.player, target) * Math.sqrt(Math.max(1, 4 - target.countCards("h")));
					});
					("step 1");
					if (result.bool) {
						var target = result.targets[0];
						player.line(target, "green");
						target.draw();
					}
				},
				group: "qlrongchu_equip3_discard",
				subSkill: {
					discard: {
						trigger: {
							player: "loseAfter",
							global: "loseAsyncAfter",
						},
						usable(skill, player) {
							return 5 - player.countCards("h", card => card.hasGaintag("qlrongchu_tag"));
						},
						forced: true,
						filter(event, player) {
							return event.type == "discard" && event.getParent(3).name != "qlrongchu_equip3skill_discard" && event.getParent("phaseDiscard").player != player && event.getl(player).cards2.length > 0 && game.hasPlayer(target => target != player && target.countDiscardableCards(player, "he") > 0);
						},
						content() {
							"step 0";
							player
								.chooseTarget(true, "请选择【戎储】的目标", "弃置一名其他角色的一张牌", function (card, player, target) {
									return target != player && target.countDiscardableCards(player, "he") > 0;
								})
								.set("ai", function (target) {
									var player = _status.event.player;
									return get.effect(target, { name: "guohe_copy2" }, player, player);
								});
							("step 1");
							if (result.bool) {
								var target = result.targets[0];
								player.line(target, "green");
								player.discardPlayerCard(target, "he", true);
							}
						},
					},
				},
				skill_id: "qlrongchu_equip3skill",
				_priority: 0,
			},
			equip4skill: {
				enable: "phaseUse",
				usable(skill, player) {
					return 5 - player.countCards("h", card => card.hasGaintag("qlrongchu_tag"));
				},
				filterTarget(card, player, target) {
					return player.canCompare(target);
				},
				filter(event, player) {
					return player.countCards("h") > 0;
				},
				async content(event, trigger, player) {
					const bool = await player.chooseToCompare(event.target).forResultBool();
					if (bool) {
						await player.gainPlayerCard(event.target, "he");
						await player.draw();
					} else {
						await player.draw();
					}
				},
			},
			equip5skill: {
				mod: {
					maxHandcard(player, num) {
						return num + (5 - player.countCards("h", card => card.hasGaintag("qlrongchu_tag")));
					},
				},
			},
		},
	},
	yhjunlve: {
		audio: "nzry_junlve",
		//marktext:"军",
		intro: {
			content: "当前有#个标记",
		},
		trigger: {
			player: "damageAfter",
			source: "damageSource",
		},
		forced: true,
		content() {
			player.addMark("yhjunlve", trigger.num);
		},
		ai: {
			combo: "yhcuike",
		},
	},
	yhcuike: {
		audio: "nzry_cuike",
		trigger: {
			player: "phaseUseBegin",
		},
		direct: true,
		content() {
			"step 0";
			if (player.countMark("yhjunlve") % 2 == 1) {
				player.chooseTarget("是否发动【摧克】，对一名角色造成1点伤害？").ai = function (target) {
					return -get.attitude(player, target);
				};
			} else {
				player.chooseTarget("是否发动【摧克】，横置一名角色并弃置其区域内的一张牌？").ai = function (target) {
					return -get.attitude(player, target);
				};
			}
			("step 1");
			if (result.bool) {
				player.logSkill("yhcuike", result.targets);
				if (player.countMark("yhjunlve") % 2 == 1) {
					result.targets[0].damage();
				} else {
					result.targets[0].link(true);
					player.discardPlayerCard(result.targets[0], 1, "hej", true);
				}
			}
		},
		ai: {
			notemp: true,
		},
	},
	qlquanheng: {
		trigger: {
			global: "phaseBegin",
		},
		filter(event, player) {
			return player.isDamaged();
		},
		async cost(event, trigger, player) {
			const list = get.inpileVCardList(info => {
				return info[0] == "trick";
			});
			if (!list?.length) {
				return;
			}
			const result = await player
				.chooseButton([get.prompt(event.skill, trigger.player), [list, "vcard"]])
				.set("ai", button => {
					const { player, current } = get.event();
					if (get.attitude(player, current) <= 0) {
						return 0;
					}
					const card = get.autoViewAs({ name: button.link[2] }, "unsure");
					return current.getUseValue(card);
				})
				.set("current", trigger.player)
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0][2],
				};
			}
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: card,
				name,
			} = event,
				skill = `${name}_viewas`;
			player.popup(card);
			game.log(player, "声明了", card);
			target.addTempSkill(skill);
			target.markAuto(skill, card);
		},
		subSkill: {
			viewas: {
				charlotte: true,
				onremove: true,
				enable: "chooseToUse",
				onChooseToUse(event) {
					if (game.online) {
						return;
					}
					const list = event.player.getStorage("qlquanheng_viewas").filter(name => {
						return event.filterCard(get.autoViewAs({ name }, "unsure"), event.player, event);
					});
					event.set("qlquanheng", list);
				},
				filter(event, player) {
					if (!player.countCards("hse")) {
						return false;
					}
					return event.qlquanheng?.length;
				},
				chooseButton: {
					dialog(event, player) {
						const list = event.qlquanheng.map(name => ["锦囊", "", name]);
						const dialog = ui.create.dialog("权衡", [list, "vcard"]);
						dialog.direct = true;
						return dialog;
					},
					check(button) {
						const player = get.player(),
							card = get.autoViewAs({ name: button.link[2] }, "unsure");
						return player.getUseValue(card);
					},
					backup(links, player) {
						return {
							filterCard: true,
							audio: "qlquanheng",
							popname: true,
							check(card) {
								return 8 - get.value(card);
							},
							position: "hse",
							viewAs: {
								name: links[0][2],
							},
							async precontent(event, trigger, player) {
								event.result.skill = "qlquanheng_viewas";
								player.unmarkAuto("qlquanheng_viewas", event.result.card.name);
							},
						};
					},
					prompt(links, player) {
						return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
					},
				},
				hiddenCard(player, name) {
					return player.getStorage("qlquanheng_viewas").includes(name) && player.countCards("she");
				},
				ai: {
					respondSha: true,
					respondShan: true,
					skillTagFilter(player, tag, arg) {
						if (!player.countCards("hse")) {
							return false;
						}
						const name = `s${tag.slice(8)}`;
						return player.getStorage("qlquanheng_viewas").includes(name);
					},
					order: 7,
					result: {
						player(player) {
							if (_status.event.dying) {
								return get.attitude(player, _status.event.dying);
							}
							return 1;
						},
					},
				},
			},
		},
	},
	qlchengxiong: {
		trigger: {
			global: "dieBegin",
		},
		unique: true,
		mark: true,
		skillAnimation: true,
		limited: true,
		animationColor: "orange",
		async content(event, trigger, player) {
			await player.awakenSkill(event.name);
			await trigger.player.recover(114514);
			trigger.cancel(true);
			trigger.player.draw(player.hp);
		},
	},
	qlshelie: {
		audio: "shelie",
		trigger: {
			player: "phaseDrawBegin1",
		},
		filter(event, player) {
			return !event.numFixed;
		},
		content() {
			"step 0";
			event.cards = get.cards(5);
			game.cardsGotoOrdering(event.cards);
			event.videoId = lib.status.videoId++;
			game.broadcastAll(
				function (player, id, cards) {
					var str;
					if (player == game.me && !_status.auto) {
						str = "涉猎：获取花色各不相同的牌";
					} else {
						str = "涉猎";
					}
					var dialog = ui.create.dialog(str, cards);
					dialog.videoId = id;
				},
				player,
				event.videoId,
				event.cards
			);
			event.time = get.utc();
			game.addVideo("showCards", player, ["涉猎", get.cardsInfo(event.cards)]);
			game.addVideo("delay", null, 2);
			("step 1");
			var list = [];
			for (var i of cards) {
				list.add(get.suit(i, false));
			}
			var next = player.chooseButton(list.length, true);
			next.set("dialog", event.videoId);
			next.set("filterButton", function (button) {
				for (var i = 0; i < ui.selected.buttons.length; i++) {
					if (get.suit(ui.selected.buttons[i].link) == get.suit(button.link)) {
						return false;
					}
				}
				return true;
			});
			next.set("ai", function (button) {
				return get.value(button.link, _status.event.player);
			});
			("step 2");
			if (result.bool && result.links) {
				event.cards2 = result.links;
			} else {
				event.finish();
			}
			var time = 1000 - (get.utc() - event.time);
			if (time > 0) {
				game.delay(0, time);
			}
			("step 3");
			game.broadcastAll("closeDialog", event.videoId);
			var cards2 = event.cards2;
			player.gain(cards2, "log", "gain2");
		},
		ai: {
			threaten: 1.2,
		},
		skill_id: "shelie",
		_priority: 0,
	},
	qlquanxue: {
		trigger: {
			global: ["damageEnd", "dying"],
		},
		frequent: true,
		filter: function (event, player) {
			if (event.name == "damage" && !event.source?.hasSkill("qlquanxue_target")) {
				return false;
			}
			if (event.name == "dying" && !event.player.hasSkill("qlquanxue_target")) {
				return false;
			}
			return true;
		},
		getIndex(event) {
			return event.name == "damage" ? event.num : 1;
		},
		async content(event, trigger, player) {
			const result = await player.chooseTarget().set("prompt", "令一名角色执行效果").forResult();
			if (result.bool) {
				if (trigger.name == "dying") {
					await result.targets[0].useSkill("qlshelie");
				} else {
					await result.targets[0].draw(2);
				}
			}
		},
		group: "qlquanxue_mark",
		subSkill: {
			mark: {
				trigger: {
					global: "roundStart",
				},
				frequent: true,
				async content(event, trigger, player) {
					const result = await player
						.chooseTarget()
						.set("prompt", "令一名角色成为【劝学】角色")
						.set("filterTarget", function (target) {
							return true;
						})
						.forResult();
					if (result.bool) {
						await result.targets[0].addTempSkill("qlquanxue_target", { global: "roundEnd" });
					}
				},
			},
		},
	},
	//月相
	shi_moon_skill: {
		locked: true,
		charlotte: true,
		moonskill: true,
		forced: true,
		LastDo: true,
		popup: false,
		trigger: {
			player: "damageBegin1",
		},
		filter(event, player) {
			return _status._moonPhase == "shi_moon";
		},
		async content(event, trigger, player) {
			let result = await player.ql_moonJudge(50);
			if (result.bool) {
				trigger.num *= 2;
			}
		},
	},
	xin_moon_skill: {
		locked: true,
		charlotte: true,
		moonskill: true,
		forced: true,
		priority: 11,
		popup: false,
		trigger: {
			player: "phaseEnd",
		},
		filter(event, player) {
			return _status._moonPhase == "xin_moon";
		},
		async content(event, trigger, player) {
			var targets = game.filterPlayer();
			for (let target of targets) {
				let num = Math.floor(Math.random() * 6) + 1;
				if (num > 3) await target.draw();
			}
		},
	},
	man_moon_skill: {
		locked: true,
		charlotte: true,
		moonskill: true,
		forced: true,
		LastDo: true,
		popup: false,
		trigger: {
			player: "useCardToPlayered",
		},
		filter(event, player) {
			if (_status._moonPhase != "man_moon") return false;
			return event.target;
		},
		async content(event, trigger, player) {
			trigger.target.addTempSkill("qinggang2");
			trigger.target.storage.qinggang2.add(trigger.card);
			trigger.target.markSkill("qinggang2");
			trigger.directHit.add(trigger.target);
		},
	},
	can_moon_skill: {
		locked: true,
		charlotte: true,
		moonskill: true,
		forced: true,
		LastDo: true,
		popup: false,
		trigger: {
			player: "recoverBegin",
		},
		filter(event, player) {
			return _status._moonPhase == "can_moon";
		},
		async content(event, trigger, player) {
			let result = await player.ql_moonJudge();
			if (result.bool) {
				trigger.cancel();
			}
		},
	},
	yingtu_moon_skill: {
		locked: true,
		charlotte: true,
		moonskill: true,
		forced: true,
		LastDo: true,
		popup: false,
		trigger: {
			player: "phaseDrawBegin2",
		},
		filter(event, player) {
			if (_status._moonPhase != "yingtu_moon") return false;
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			let result = await player.ql_moonJudge();
			if (result.bool) {
				trigger.num++;
			}
		},
	},
	kuitu_moon_skill: {
		locked: true,
		charlotte: true,
		moonskill: true,
		forced: true,
		LastDo: true,
		popup: false,
		trigger: {
			player: "phaseDrawBegin2",
		},
		filter(event, player) {
			if (_status._moonPhase != "kuitu_moon") return false;
			return !event.numFixed && event.num > 0;
		},
		async content(event, trigger, player) {
			let result = await player.ql_moonJudge();
			if (result.bool) {
				trigger.num--;
			}
		},
	},

	qllianzhu2: {
		trigger: {
			player: "phaseBegin",
		},
		forced: true,
		locked: true,
		audio: "ext:五花米线/audio/skill:2",
		filter(event, player) {
			return player.countCards("h");
		},
		async content(event, trigger, player) {
			await player.draw(2);
			var hs = player.getCards("h");
			await player.showCards(hs, get.translation(player) + "发动了【连竹】");
			await player.addTempSkill("qllianzhu2_use");
			var list = [];
			for (var i of hs) {
				list.add(get.type2(i, player));
				if (list.length >= 3) {
					break;
				}
			}
			if (list.length >= 1) {
				await player.addTempSkill("qllianzhu2_dircet");
			}
			if (list.length >= 2) {
				await player.addTempSkill("qllianzhu2_add");
			}
			if (list.length >= 3) {
				var num = player.getDamagedHp + 1;
				var cards = [];
				for (var i = 0; i < num; i++) {
					var card = get.cardPile(card => card.name == "sha" && !cards.includes(card));
					if (card) cards.push(card);
				}
				if (cards.length) player.gain(cards, "gain2");
			}
			const result = await player.discardPlayerCard("hesj", player).set("selectButton", [1, Infinity]).forResult();
			if (result.bool) {
				await player.addMark("qllianzhu2", result.cards.length);
			}
		},
		group: "qllianzhu2_clear",
		subSkill: {
			clear: {
				trigger: {
					player: "phaseBegin",
				},
				forced: true,
				locked: true,
				filter: function (event, player) {
					return player.hasMark("qllianzhu2");
				},
				async content(event, trigger, player) {
					await player.clearMark("qllianzhu2");
				},
				skill_id: "qllianzhu2_clear",
				sub: true,
				sourceSkill: "qllianzhu2",
				_priority: 100,
			},
			dircet: {
				forced: true,
				trigger: {
					player: "useCard",
				},
				filter: function (event, player) {
					return (
						event.card &&
						(get.type(event.card) == "trick" || (get.type(event.card) == "basic" && !["shan", "tao", "jiu", "du"].includes(event.card.name))) &&
						game.hasPlayer(function (current) {
							return true;
						})
					);
				},
				content: function () {
					trigger.directHit.addArray(
						game.filterPlayer(function (current) {
							return true;
						})
					);
				},
				ai: {
					directHit_ai: true,
					skillTagFilter: function (player, tag, arg) {
						return true;
					},
				},
				skill_id: "qllianzhu2_dircet",
				sub: true,
				_priority: 10,
				sourceSkill: "qllianzhu2",
			},
			add: {
				mod: {
					cardUsable(card) {
						return Infinity;
					},
				},
				skill_id: "qllianzhu2_add",
				sub: true,
				_priority: 10,
				sourceSkill: "qllianzhu2",
			},
		},
		skill_id: "qllianzhu2",
		_priority: 0,
	},
	qlyunwei: {
		trigger: {
			player: "useCard",
			target: "useCardToTargeted",
		},
		usable: function (event, player) {
			return player.countMark("qllianzhu2");
		},
		filter: function (event, player) {
			if (event.name == "useCard" && event.card.name != "sha" && get.type(event.card) != "trick") {
				return false;
			}
			if (event.name == "useCardToTargeted" && event.player == player) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			if (trigger.name == "useCard" && trigger.card.name == "sha") {
				await player.chooseToDiscard(true);
				if (!trigger.baseDamage) trigger.baseDamage = 1;
				trigger.baseDamage += player.getHistory("useCard", evt => evt.card.name == "sha").length;
			} else if (trigger.name == "useCard" && get.type(trigger.card) == "trick") {
				await player.chooseToDiscard(true);
				const num = player.getHistory("useCard", evt => get.type(evt.card) == "trick").length;
				trigger.effectCount += num;
			} else {
				await player.chooseToDiscard(true);
				let num = 0;
				game.countPlayer2(current => {
					num += current.getHistory("useCard").filter(evt => ["basic", "trick"].includes(get.type2(evt.card)) && evt.targets?.includes(player)).length;
				});
				await player.draw(num);
			}
		},
		skill_id: "qlyunwei",
	},
	ql_ying_huoyu: {
		trigger: {
			player: "damageBegin1",
		},
		forced: true,
		unique: true,
		filter(event) {
			return event.hasNature("fire");
		},
		content() {
			trigger.cancel();
			player.recover(trigger.num);
		},
		ai: {
			effect: {
				target(card) {
					if (get.tag(card, "fireDamage")) {
						return [0, 2, 0, 0];
					}
				},
			},
		},
		group: ["ql_ying_huoyu_discard", "ql_ying_huoyu_damage"],
		subSkill: {
			discard: {
				trigger: {
					player: "loseEnd",
				},
				frequent: true,
				filter(event, player) {
					if (player.countCards("h")) {
						return false;
					}
					for (var i = 0; i < event.cards.length; i++) {
						if (event.cards[i].original == "h") {
							return true;
						}
					}
					return false;
				},
				content() {
					"step 0";
					var players = get.players(player);
					players.remove(player);
					event.players = players;
					("step 1");
					if (event.players.length) {
						var current = event.players.shift();
						var hs = current.getCards("h");
						if (hs.length) {
							current.lose(hs);
							current.$throw(hs);
						}
						game.delay(0.5);
						event.redo();
					}
				},
				skill_id: "ql_ying_huoyu_discard",
				sub: true,
				_priority: 0,
			},
			damage: {
				trigger: {
					global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				direct: true,
				filter(event, player) {
					if (_status.currentPhase != player) {
						return false;
					}
					return game.hasPlayer(current => {
						if (current == player || current.countCards("h")) {
							return false;
						}
						var evt = event.getl(current);
						return evt && evt.hs && evt.hs.length;
					});
				},
				check(event, player) {
					return get.damageEffect(event.player, player, player) > 0;
				},
				content() {
					"step 0";
					var targets = game.filterPlayer(current => {
						if (current == player || current.countCards("h")) {
							return false;
						}
						var evt = trigger.getl(current);
						return evt && evt.hs && evt.hs.length;
					});
					event.targets = targets;
					("step 1");
					var target = event.targets.shift();
					event.target = target;
					player.chooseBool(get.prompt2("ql_ying_huoyu", target)).set("ai", () => {
						return get.damageEffect(_status.event.getParent().target, _status.event.player, _status.event.player) >= 0;
					});
					("step 2");
					if (result.bool) {
						player.logSkill("ql_ying_huoyu_damage", target);
						target.damage("fire");
					}
					("step 3");
					if (targets.length) {
						event.goto(1);
					}
				},
				ai: {
					threaten: 1.1,
				},
				skill_id: "ql_ying_huoyu_damage",
				sub: true,
				_priority: 0,
			},
		},
		skill_id: "ql_ying_huoyu",
		_priority: 0,
	},
	ql_ying_xundi: {
		trigger: {
			player: "phaseJieshuBegin",
		},
		locked: true,
		forced: true,
		async content(event, trigger, player) {
			await player.draw(player.countCards("h") ? 2 : 5);
			let targets = game.filterPlayer(current => current != player).sortBySeat();
			player.line(targets, "green");
			if (targets.length) {
				for (var i = 0; i < targets.length; i++) {
					targets[i].link(true);
				}
			}
			await player.gainMultiple(targets, "hej");
		},
		skill_id: "ql_ying_xundi",
		_priority: 0,
	},
	ql_ying_huoshi: {
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		frequent: true,
		filter(event, player) {
			if (event.name == "gain" && event.player == player) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.cards2 && evt.cards2.length > 0;
		},
		async content(event, trigger, player) {
			const judgeEvent = player.judge(card => {
				if (get.color(card) == "red") return 2;
				return -0.5;
			});
			judgeEvent.judge2 = result => result.bool;
			const { bool } = await judgeEvent.forResult();
			if (bool) {
				var evt = trigger.getParent();
				if (evt.name == "useCard") {
					await player.recover();
				} else {
					const result = await player
						.chooseTarget("令一名角色失去体力", true)
						.set("prompt", "令一名角色失去一点体力")
						.set("ai", function (target) {
							return Math.max(1, 9 - target.hp);
						})
						.forResult();
					if (result.bool) {
						player.line(result.targets[0]);
						await result.targets[0].loseHp();
					}
				}
			}
		},
		skill_id: "ql_ying_huoshi",
		_priority: 0,
	},
	ql_ying_xiezhu: {
		group: ["ql_ying_xiezhu_spade", "ql_ying_xiezhu_club"],
		subSkill: {
			spade: {
				enable: "phaseUse",
				usable: 1,
				filterTarget(card, player, target) {
					if (player == target) {
						return false;
					}
					if (target.group == "unknown") {
						return false;
					}
					for (var i = 0; i < ui.selected.targets.length; i++) {
						if (ui.selected.targets[i].group == target.group) {
							return false;
						}
					}
					return target.countCards("he") > 0;
				},
				filter(event, player) {
					return player.countCards("he") > 0;
				},
				filterCard: true,
				position: "he",
				selectTarget: [1, Infinity],
				check(card) {
					if (get.suit(card) == "spade") {
						return 8 - get.value(card);
					}
					return 5 - get.value(card);
				},
				content() {
					"step 0";
					if (num == 0 && get.suit(cards[0]) == "spade") {
						player.addTempSkill("ql_ying_xiezhu_source", { source: "damageEnd" });
					}
					player.choosePlayerCard(targets[num], "he", true);
					("step 1");
					if (result.bool) {
						if (result.links.length) {
							targets[num].discard(result.links[0]);
						}
					}
				},
				ai: {
					result: {
						target: -1,
					},
					threaten: 1.2,
					order: 3,
				},
				skill_id: "ql_ying_xiezhu_spade",
				sub: true,
				_priority: 0,
			},
			source: {
				trigger: {
					source: "damageBegin",
				},
				mark: true,
				intro: {
					content: "下次造成伤害+1",
				},
				forced: true,
				content() {
					trigger.num++;
				},
				sub: true,
				sourceSkill: "ql_ying_xiezhu_spade",
				_priority: 0,
				skill_id: "ql_ying_xiezhy_source",
			},
			club: {
				trigger: {
					player: "useCardAfter",
				},
				frequent: true,
				filter: function (event, player) {
					return get.suit(event.card) == "club" && get.type(event.card) != "equip" && get.type(event.card) != "delay";
				},
				discard: false,
				async content(event, trigger, player) {
					const result = await player
						.chooseTarget()
						.set("ai", function (target) {
							return -get.attitude(_status.event.player, target);
						})
						.set("filterTarget", function (player, target) {
							return target != player;
						})
						.set("prompt", `是否将${get.translation(trigger.cards)}置于一名角色武将牌旁?`)
						.forResult();
					if (result.bool) {
						const next = result.targets[0].addToExpansion(trigger.cards, player, "giveAuto");
						next.gaintag.add("ql_ying_xiezhu_club");
						await next;
						result.targets[0].addSkill("ql_ying_xiezhu_damage");
					}
				},
				intro: {
					markcount: "expansion",
					mark(dialog, _, player) {
						const expansions = player.getExpansions("ql_ying_xiezhu_club").reverse();
						dialog.addAuto(expansions);
					},
				},
				ai: {
					expose: 0.2,
					result: {
						target(player, target) {
							return -target.hp;
						},
					},
					order: 4,
					threaten: 1.2,
				},
				skill_id: "ql_ying_xiezhu_club",
				sub: true,
				_priority: 0,
			},
			damage: {
				trigger: {
					source: "damageBegin1",
				},
				forced: true,
				mark: true,
				sourceSkill: "ql_ying_xiezhu_club",
				filter(event) {
					return event.num > 0 && event.source.getExpansions("ql_ying_xiezhu_club").length > 0;
				},
				async content(event, trigger, player) {
					trigger.num--;
					const { bool, links } = await trigger.source.chooseCardButton(get.translation("ql_ying_xiezhu"), trigger.source.getExpansions("ql_ying_xiezhu_club"), true).forResult();
					if (bool) {
						trigger.source.logSkill("ql_ying_xiezhu_damage");
						await trigger.source.loseToDiscardpile(links);
					}
				},
				intro: {
					markcount: "expansion",
					mark(dialog, _, player) {
						const expansions = player.getExpansions("ql_ying_xiezhu_club").reverse();
						dialog.addAuto(expansions);
					},
				},
				skill_id: "ql_ying_xiezhu_damage",
				sub: true,
				_priority: 0,
			},
		},
		skill_id: "ql_ying_xiezhu",
	},
	yhjieying: {
		audio: "drlt_jieying",
		/*trigger: { global: "phaseDrawBegin2" },
filter(event, player) {
return !event.numFixed && event.player.hasMark("yhjieying_mark");
},
forced: true,
locked: false,
logTarget: "player",
content() {
trigger.num++;
},*/
		global: "yhjieying_mark",
		group: ["yhjieying_1", "yhjieying_2", "yhjieying_3"],
		subSkill: {
			1: {
				audio: "drlt_jieying",
				trigger: { player: "phaseBegin" },
				filter(event, player) {
					return !game.hasPlayer(current => current.hasMark("yhjieying_mark"));
				},
				forced: true,
				content() {
					player.addMark("yhjieying_mark", 1);
				},
			},
			2: {
				audio: "drlt_jieying",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return (
						player.hasMark("yhjieying_mark") &&
						game.hasPlayer(target => {
							return target != player && !target.hasMark("yhjieying_mark");
						})
					);
				},
				direct: true,
				content() {
					"step 0";
					player.chooseTarget(get.prompt("yhjieying"), "将“营”交给一名角色；其摸牌阶段多摸一张牌且手牌上限+1。该角色回合结束后，其移去“营”标记，然后你获得其一半所有手牌。", function (card, player, target) {
						return target != player && !target.hasMark("yhjieying_mark");
					}).ai = function (target) {
						let th = target.countCards("h"),
							att = get.attitude(_status.event.player, target);
						for (let i in target.skills) {
							let info = get.info(i);
							if (!info) {
								continue;
							}
							if (get.skillInfoTranslation(i, target).includes("【杀】")) {
								return Math.abs(att);
							}
						}
						if (att > 0) {
							if (th > 3 && target.hp > 2) {
								return 0.6 * th;
							}
						}
						if (att < 1) {
							if (target.countCards("j", { name: "lebu" })) {
								return 1 + Math.min((1.5 + th) * 0.8, target.getHandcardLimit() * 0.7);
							}
							if (!th || target.getEquip("zhangba") || target.getEquip("guanshi")) {
								return 0;
							}
							if (!target.inRange(player) || player.countCards("hs", { name: "shan" }) > 1) {
								return Math.min((1 + th) * 0.3, target.getHandcardLimit() * 0.2);
							}
						}
						return 0;
					};
					("step 1");
					if (result.bool) {
						var target = result.targets[0];
						player.line(target);
						player.logSkill("yhjieying", target);
						var mark = player.countMark("yhjieying_mark");
						player.removeMark("yhjieying_mark", mark);
						target.addMark("yhjieying_mark", mark);
					}
				},
				ai: {
					effect: {
						player(card, player, target) {
							if (get.name(card) === "lebu" && get.attitude(player, target) < 0) {
								return 1 + Math.min((target.countCards("h") + 1.5) * 0.8, target.getHandcardLimit() * 0.7);
							}
						},
					},
				},
			},
			3: {
				audio: "drlt_jieying",
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					return player != event.player && event.player.hasMark("yhjieying_mark") && event.player.isIn();
				},
				forced: true,
				logTarget: "player",
				content() {
					if (trigger.player.countCards("h") > 0) {
						trigger.player.give(trigger.player.getCards("h"), player);
					}
					trigger.player.clearMark("yhjieying_mark");
				},
			},
			mark: {
				marktext: "营",
				intro: {
					name2: "营",
					content: "mark",
				},
				mod: {
					maxHandcard(player, num) {
						if (player.hasMark("yhjieying_mark")) {
							return (
								num +
								game.countPlayer(function (current) {
									return current.hasSkill("yhjieying");
								})
							);
						}
					},
					aiOrder(player, card, num) {
						if (
							player.hasMark("yhjieying_mark") &&
							game.hasPlayer(current => {
								return current.hasSkill("yhjieying") && get.attitude(player, current) <= 0;
							})
						) {
							return Math.max(num, 0) + 1;
						}
					},
					ai: {
						nokeep: true,
						skillTagFilter(player) {
							return (
								player.hasMark("yhjieying_mark") &&
								game.hasPlayer(current => {
									return current.hasSkill("yhjieying") && get.attitude(player, current) <= 0;
								})
							);
						},
					},
				},
			},
		},
	},
	yhpoxi: {
		audio: "drlt_poxi",
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
			//return target!=player;
		},
		content() {
			"step 0";
			event.list1 = [];
			event.list2 = [];
			if (player.countCards("h") > 0) {
				var chooseButton = player.chooseButton(2, ["你的手牌", player.getCards("h"), get.translation(target.name) + "的手牌", target.getCards("h")]);
			} else {
				var chooseButton = player.chooseButton(2, [get.translation(target.name) + "的手牌", target.getCards("h")]);
			}
			chooseButton.set("target", target);
			chooseButton.set("ai", function (button) {
				var player = _status.event.player;
				var target = _status.event.target;
				var ps = [];
				var ts = [];
				for (var i = 0; i < ui.selected.buttons.length; i++) {
					var card = ui.selected.buttons[i].link;
					if (target.getCards("h").includes(card)) {
						ts.push(card);
					} else {
						ps.push(card);
					}
				}
				var card = button.link;
				var owner = get.owner(card);
				var val = get.value(card) || 1;
				if (owner == target) {
					if (ts.length > 1) {
						return 0;
					}
					if (ts.length == 0 || player.hp > 3) {
						return val;
					}
					return 2 * val;
				}
				return 7 - val;
			});
			chooseButton.set("filterButton", function (button) {
				if (get.owner(button.link) && !lib.filter.canBeDiscarded(button.link, get.owner(button.link), get.player())) {
					return false;
				}
				for (var i = 0; i < ui.selected.buttons.length; i++) {
					if (get.color(button.link) == get.color(ui.selected.buttons[i].link)) {
						return false;
					}
				}
				return true;
			});
			("step 1");
			if (result.bool) {
				var list = result.links;
				for (var i = 0; i < list.length; i++) {
					if (get.owner(list[i]) == player) {
						event.list1.push(list[i]);
					} else {
						event.list2.push(list[i]);
					}
				}
				if (event.list1.length && event.list2.length) {
					game.loseAsync({
						lose_list: [
							[player, event.list1],
							[target, event.list2],
						],
						discarder: player,
					}).setContent("discardMultiple");
				} else if (event.list2.length) {
					target.discard(event.list2);
				} else {
					player.discard(event.list1);
				}
			}
			("step 2");
			if (event.list1.length + event.list2.length == 2) {
				if (event.list1.length == 0) {
					var evt = _status.event;
					for (var i = 0; i < 10; i++) {
						if (evt && evt.getParent) {
							evt = evt.getParent();
						}
						if (evt.name == "phaseUse") {
							evt.skipped = true;
							break;
						}
					}
				}
				if (event.list1.length == 2) {
					player.draw(2);
				}
			}
		},
		ai: {
			order: 6,
			result: {
				target(target, player) {
					return -1;
				},
			},
		},
	},
	yhchenglve: {
		audio: "nzry_chenglve",
		enable: "phaseUse",
		usable: 1,
		async content(event, trigger, player) {
			await player.draw();
			if (!player.hasCard(card => lib.filter.cardDiscardable(card, player, "yhchenglve"), "h")) {
				return;
			}
			await game.delayx();
			const { bool, cards } = await player.chooseToDiscard(true, "h", 1).set("ai", card => {
				const player = get.player(),
					effect = player.getStorage("yhchenglve_effect");
				const cards = player.getCards("h").filter(i => get.tag(i, "damage") > 0.5 && player.hasValueTarget(i, true, false)),
					map = {};
				for (const cardx of cards) {
					const suit = get.suit(cardx, player);
					if (typeof map[suit] != "number") {
						map[suit] = 0;
					}
					map[suit]++;
				}
				const list = [];
				for (let i in map) {
					if (map[i] > 0) {
						list.push([i, map[i]]);
					}
				}
				list.sort((a, b) => b[1] - a[1]);
				if (effect.includes(get.suit(card, player))) {
					return 0;
				}
				if (list.some(i => i[0] == get.suit(card, player)) && !player.hasUseTarget(card, false)) {
					return 10;
				}
				if (player.storage.yhchenglve && ui.selected.cards.length && !ui.selected.cards.some(i => get.suit(i) == get.suit(card, player))) {
					return 2;
				}
				return 6 - get.value(card);
			}).forResult();
			if (bool) {
				const effect = "yhchenglve_effect";
				player.addTempSkill(effect);
				player.markAuto(effect, cards.map(card => get.suit(card, player)).unique());
				player.storage[effect].sort((a, b) => lib.suits.indexOf(b) - lib.suits.indexOf(a));
				player.addTip(effect, get.translation(effect) + player.getStorage(effect).reduce((str, suit) => str + get.translation(suit), ""));
			}
		},
		ai: {
			order(item, player) {
				if (player.countCards("h", card => get.tag(card, "damage") > 0.5 && player.hasValueTarget(card, true, false)) > 2) {
					return get.order({ name: "sha" }) + 0.14;
				}
				return 2.7;
			},
			result: {
				player(player) {
					if (!player.storage.yhchenglve && player.countCards("h") < 3) {
						return 0;
					}
					return 1;
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				mod: {
					cardUsable(card, player) {
						const suit = get.suit(card);
						if (suit == "unsure" || player.getStorage("yhchenglve_effect").includes(suit)) {
							return Infinity;
						}
					},
					targetInRange(card, player) {
						const suit = get.suit(card);
						if (suit == "unsure" || player.getStorage("yhchenglve_effect").includes(suit)) {
							return true;
						}
					},
				},
				marktext: "略",
				intro: { content: `本回合使用$花色的牌无距离和次数限制` },
			},
		},
	},
	yhshicai: {
		audio: "nzry_shicai_2",
		locked: false,
		usable: 1,
		mod: {
			aiOrder(player, card, num) {
				if (num <= 0 || player.yhshicai_aiOrder || get.itemtype(card) !== "card" || player.hasSkillTag("abnormalDraw")) {
					return num;
				}
				let type = get.type2(card, false);
				if (
					player.hasHistory("useCard", evt => {
						return get.type2(evt.card, false) == type;
					})
				) {
					return num;
				}
				player.yhshicai_aiOrder = true;
				let val = player.getUseValue(card, true, true);
				delete player.yhshicai_aiOrder;
				return 20 * val;
			},
		},
		trigger: { player: ["useCardAfter", "useCardToTargeted"] },
		prompt2(event, player) {
			const cards = event.cards.filterInD("oe");
			return "你可以将" + get.translation(cards) + (cards.length > 1 ? "以任意顺序" : "") + "置于牌堆顶，然后摸一张牌";
		},
		filter(event, player) {
			if (!event.cards.someInD()) {
				return false;
			}
			let evt = event,
				type = get.type2(evt.card, false);
			if (event.name == "useCardToTargeted") {
				if (type != "equip" || player != event.target) {
					return false;
				}
				evt = evt.getParent();
			} else {
				if (type == "equip") {
					return false;
				}
			}
			return !player.hasHistory(
				"useCard",
				evtx => {
					return evtx != evt && get.type2(evtx.card, false) == type;
				},
				evt
			);
		},
		check(event, player) {
			if (get.type(event.card) == "equip") {
				if (get.subtype(event.card) == "equip6") {
					return true;
				}
				if (get.equipResult(player, player, event.card) <= 0) {
					return true;
				}
				const eff1 = player.getUseValue(event.card);
				const subtype = get.subtype(event.card);
				return (
					player.countCards("h", function (card) {
						return get.subtype(card) == subtype && player.getUseValue(card) >= eff1;
					}) > 0
				);
			}
			return true;
		},
		async content(event, trigger, player) {
			let cards = trigger.cards.filterInD();
			if (cards.length > 1) {
				const result = await player
					.chooseToMove("恃才：将牌按顺序置于牌堆顶", true)
					.set("list", [["牌堆顶", cards]])
					.set("reverse", _status.currentPhase?.next && get.attitude(player, _status.currentPhase.next) > 0)
					.set("processAI", function (list) {
						const cards = list[0][1].slice(0);
						cards.sort(function (a, b) {
							return (_status.event.reverse ? 1 : -1) * (get.value(b) - get.value(a));
						});
						return [cards];
					}).forResult();
				if (!result.bool) {
					return;
				}
				cards = result.moved[0];
			}
			cards.reverse();
			await game.cardsGotoPile(cards, "insert");
			game.log(player, "将", cards, "置于了牌堆顶");
			await player.draw();
		},
		subSkill: { 2: { audio: 2 } },
		ai: {
			reverseOrder: true,
			skillTagFilter(player) {
				if (
					player.getHistory("useCard", function (evt) {
						return get.type(evt.card) == "equip";
					}).length > 0
				) {
					return false;
				}
			},
			effect: {
				target_use(card, player, target) {
					if (
						player == target &&
						get.type(card) == "equip" &&
						!player.getHistory("useCard", function (evt) {
							return get.type(evt.card) == "equip";
						}).length
					) {
						return [1, 3];
					}
				},
			},
		},
	},
	yhcunmu: {
		audio: "nzry_cunmu",
		audioname: ["ol_pengyang"],
		trigger: {
			player: "drawBegin",
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.bottom = true;
		},
		ai: {
			abnormalDraw: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "abnormalDraw") {
					return !arg || arg === "bottom";
				}
			},
		},
	},
	qllongwei: {
		global: "qllongwei_effect",
		group: ["qllongwei_horse", "qllongwei_5"],
		subSkill: {
			effect: {
				mod: {
					targetInRange(card, player, target) {
						if (target.hasDisabledSlot(1)) {
							return true;
						}
					},
					cardUsableTarget(card, player, target) {
						if (target.hasDisabledSlot(1)) {
							return true;
						}
					},
				},
				trigger: {
					player: "damageEnd",
					source: "damageEnd",
				},
				audio: "ext:五花米线/audio/skill:2",
				forced: true,
				locked: true,
				usable: 3,
				filter(event, player) {
					const target = event.source == player ? event.player : event.source;
					return target.hasDisabledSlot(2);
				},
				getIndex(event) {
					return event.num;
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
			5: {
				trigger: {
					global: "gainAfter",
				},
				audio: "ext:五花米线/audio/skill:2",
				usable: 1,
				locked: true,
				forced: true,
				filter(event, player) {
					return event.player != player && event.player.hasDisabledSlot(5);
				},
				async content(event, trigger, player) {
					var cards = trigger.player.getGainableCards(player, "he").randomGets(1);
					event.cards = cards;
					player.gain(trigger.player, cards, "give", "bySelf");
				},
				skill_id: "qljiaoxue3_5",
				sub: true,
				_priority: 0,
			},
			horse: {
				trigger: {
					global: "phaseDrawBegin2",
				},
				audio: "ext:五花米线/audio/skill:2",
				forced: true,
				locked: true,
				filter(event, player) {
					return event.player != player && (event.player.hasDisabledSlot(3) || event.player.hasDisabledSlot(3)) && !event.numFixed;
				},
				async content(event, trigger, player) {
					trigger.num--;
					await player.draw();
				},
				skill_id: "qllongwei_effect_horse",
				sub: true,
				_priority: 0,
			},
		},
		skill_id: "qllongwei",
	},
	qlzhandi: {
		trigger: {
			//player: ["phaseBegin","damageAfter"],
			//source: "damageAfter",
			global: "qlzhandi_used",
		},
		chargeSkill: 3,
		audio: "ext:五花米线/audio/skill:2",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget()
				.set("ai", function (target) {
					return -get.attitude(_status.event.player, target);
				})
				.set("filterTarget", function (event, player, target) {
					return target != player;
				})
				.set("selectTarget", 1)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.line(target);
			const judgeEvent = await target.judge().forResult();
			const card = judgeEvent.card;
			await player.gain(card, "gain2");
			const suit = judgeEvent.suit;
			switch (suit) {
				case "club":
					if (target.hasEnabledSlot(1)) {
						await target.disableEquip(1);
					} else {
						await target.die();
						await player.gainMaxHp();
						await player.draw(3);
						await player.recover();
					}
					break;
				case "spade":
					if (target.hasEnabledSlot(2)) {
						await target.disableEquip(2);
					} else {
						await target.die();
						await player.gainMaxHp();
						await player.draw(3);
						await player.recover();
					}
					break;
				case "heart":
					if (target.hasEnabledSlot("horse")) {
						await target.disableEquip(3);
						await target.disableEquip(4);
					} else {
						await target.die();
						await player.gainMaxHp();
						await player.draw(3);
						await player.recover();
					}
					break;
				case "diamond":
					if (target.hasEnabledSlot(5)) {
						await target.disableEquip(5);
					} else {
						await target.die();
						await player.gainMaxHp();
						await player.draw(3);
						await player.recover();
					}
					break;
				default:
					await player.chat("意料之外的结果");
					break;
			}
		},
		group: ["qlzhandi_init", "qlzhandi_use"],
		subSkill: {
			init: {
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				forced: true,
				locked: false,
				direct: true,
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				async content(event, trigger, player) {
					await player.addCharge(2);
				},
			},
			use: {
				trigger: {
					player: ["phaseBegin", "damageAfter"],
					source: "damageAfter",
				},
				forced: true,
				locked: true,
				direct: true,
				getIndex(event) {
					return event.name == "damage" ? event.num : 1;
				},
				async content(event, trigger, player) {
					await player.addCharge();
					if (player.countCharge() == 3) {
						player.removeCharge(3);
						let next = game.createEvent("qlzhandi_used");
						next.player = player;
						next.setContent(() => {
							event.trigger(event.name);
						});
					}
				},
			},
		},
		skill_id: "qlzhandi",
		_priority: 0,
	},
	qlyulian: {
		mod: {
			targetInRange(card, player, target) {
				if (card.name == "bingliang") {
					return true;
				}
			},
		},
		enable: "chooseToUse",
		filterCard(card) {
			return get.color(card) == "black";
		},
		filter(event, player) {
			return player.countCards("hes", { color: "black" });
		},
		position: "hes",
		viewAs: {
			name: "bingliang",
		},
		prompt: "将一黑色的牌当兵粮寸断使用",
		check(card) {
			return 6 - get.value(card);
		},
	},
	qltianfa: {
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return target.countDiscardableCards(player, "j") > 0;
		},
		async content(event, trigger, player) {
			const result = await player.discardPlayerCard(event.targets[0]).set("position", "j").set("selectButton", [1, Infinity]).forResult();
			if (result.bool) {
				const num2 = result.cards.length;
				if (num2 == 1) {
					await event.targets[0].damage("thunder");
					player.tempBanSkill("qltianfa", { player: "phaseUseEnd" });
				} else {
					const result2 = await player.chooseToDiscard(num2 - 1).forResult();
					if (result2.bool) {
						await event.targets[0].damage(num2, "thunder");
					} else {
						return;
					}
				}
			}
		},
	},
	qlhusheng: {
		trigger: {
			player: "phaseDrawBefore",
		},
		async content(event, trigger, player) {
			trigger.cancel();
			if (player.countCards("h") < 5) {
				await player.drawTo(5);
			}
			let targets = [];
			while (game.hasPlayer(current => current != player && !targets.includes(current))) {
				const result = await player
					.chooseCardTarget({
						prompt: "交给一名其他角色两张牌，然后令其交给你两张牌",
						filterCard: true,
						selectCard: 2,
						position: "he",
						filterTarget(card, player, target) {
							if (player == target) {
								return false;
							}
							return !get.event().selectTargets.includes(target);
						},
						selectTargets: targets,
						ai1(card) {
							return 6 - get.value(card);
						},
						ai2(target) {
							return get.attitude(get.player(), target);
						},
					})
					.forResult();
				if (!result?.bool) {
					return;
				}
				const {
					cards,
					targets: [target],
				} = result;
				targets.add(target);
				await player.give(cards, target);
				const hs = target.getCards("he");
				const result2 =
					hs.length > 2
						? await target.chooseToGive(player, 2, "he", true).forResult()
						: {
							bool: true,
							cards: hs,
						};
				if (result2?.bool) {
					if (result2.cards?.length) {
						await target.give(result2.cards, player);
					}
					if (!result2.cards?.length || !result2.cards.containsSome(...cards)) {
						const result3 = await player
							.chooseCard("呼声：是否重铸五张牌？", 5, "he", (card, player) => {
								return lib.filter.cardRecastable(card, player);
							})
							.set("ai", card => {
								return 7 - get.value(card);
							})
							.forResult();
						if (result3?.bool && result3.cards?.length) {
							await player.recast(result3.cards);
						}
					}
				}
			}
		},
	},
	qlyingguang: {
		trigger: {
			player: "phaseUseBefore",
		},
		async content(event, trigger, player) {
			trigger.cancel();
			player.skip("phaseDiscard");
			const cards = [],
				num = player.getDamagedHp() + 1;
			while (cards.length < num) {
				const card = get.cardPile(card => get.tag(card, "damage") && !cards.includes(card));
				if (card) {
					cards.add(card);
				} else {
					break;
				}
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
		},
	},
	qlyingyuan: {
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			if (!player.hasHistory("sourceDamage")) {
				return true;
			}
			return !game.hasGlobalHistory("everything", evtx => {
				if (evtx.name != "phaseDraw" || evtx.player != player) {
					return false;
				}
				return !evtx._cancelled;
			});
		},
		frequent: true,
		async content(event, trigger, player) {
			const evt = trigger.getParent("phase", true);
			if (!evt) {
				return;
			}
			let num = evt.num + 1;
			if (!player.hasHistory("sourceDamage")) {
				player
					.when("phaseUseBefore")
					.filter(evtx => evtx._extraPhaseReason == event.name)
					.step(async (event, trigger, player) => {
						player.addTempSkill("qlyingyuan_anke", { global: "phaseChange" });
					});
				evt.phaseList.splice(num, 0, `phaseUse|${event.name}`);
				num++;
			}
			if (
				!game.hasGlobalHistory("everything", evtx => {
					if (evtx.name != "phaseDraw" || evtx.player != player) {
						return false;
					}
					return !evtx._cancelled;
				})
			) {
				evt.phaseList.splice(num, 0, `phaseDraw|${event.name}`);
				num++;
			}
		},
		derivation: "qlanke",
		subSkill: {
			anke: {
				init(player, skill) {
					player.addAdditionalSkill(skill, ["qlanke"]);
				},
				onremove(player, skill) {
					player.removeAdditionalSkill(skill);
				},
				charlotte: true,
				mark: true,
				marktext: "安可",
				intro: {
					content: "视为拥有〖安可〗",
				},
			},
		},
	},
	qlanke: {
		trigger: {
			player: "useCardToPlayer",
		},
		filter(event, player) {
			if (event.target == player || !get.tag(event.card, "damage")) {
				return false;
			}
			return event.targets?.length == 1 && player.countCards("he");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard("he", [1, 4], get.prompt2(event.skill))
				.set("ai", card => {
					return 4 - get.value(card);
				})
				.set("chooseonly", true)
				.forResult();
		},
		async content(event, trigger, player) {
			await player.modedDiscard(event.cards);
			trigger.getParent().baseDamage += event.cards.length;
			let num = game.hasPlayer(current => current != trigger.target && lib.filter.targetEnabled2(trigger.card, trigger.player, current)) ? 4 : 3;
			const result =
				num > event.cards.length
					? await player
						.chooseButton(
							[
								`安可：选择${get.cnNumber(event.cards.length, true)}项执行`,
								[
									[
										["direct", "此牌不可响应"],
										["unequip", "此牌无视防具"],
									],
									"tdnodes",
								],
								[
									[
										["target", "此牌目标+1"],
										["damage", "此牌伤害翻倍"],
									],
									"tdnodes",
								],
							],
							event.cards.length,
							true
						)
						.set("ai", button => {
							return [null, "unequip", "target", "damage", "direct"].indexOf(button.link) + 2 * Math.random();
						})
						.forResult()
					: {
						bool: true,
						links: ["unequip", "target", "damage", "direct"],
					};
			if (!result?.bool) {
				return;
			}
			if (result.links.includes("direct")) {
				trigger.getParent().directHit.addArray(game.players);
			}
			if (result.links.includes("unequip")) {
				trigger.getParent().card.anke_unequip = true;
			}
			if (result.links.includes("target")) {
				const targets = game.filterPlayer(current => current != trigger.target && lib.filter.targetEnabled2(trigger.card, trigger.player, current));
				if (targets?.length) {
					const result2 =
						targets.length > 1
							? await player
								.chooseTarget("令一名角色成为此牌的目标", (card, player, target) => {
									return get.event().targetx.includes(target);
								})
								.set("targetx", targets)
								.set("ai", target => {
									const trigger = get.event().getTrigger();
									return get.effect(target, trigger.card, trigger.player, trigger.player);
								})
								.forResult()
							: {
								bool: true,
								targets: targets,
							};
					if (result2?.targets?.length) {
						player.line(result2.targets);
						game.log(player, "令", result2.targets, "成为了", trigger.card, "的额外目标");
						trigger.getParent().targets.addArray(result2.targets);
					}
				}
			}
			if (result.links.includes("damage")) {
				trigger.getParent().baseDamage ??= 1;
				trigger.getParent().baseDamage *= 2;
			}
		},
	},
	qlzhuomu: {
		trigger: { global: "roundStart" },
		async cost(event, trigger, player) {
			const result = await player.chooseControl("上家", "下家", "cancel2").set("prompt", get.prompt2(event.skill)).forResult();
			if (result.control != "cancel2") {
				event.result = { bool: true, cost_data: { control: result.control } };
			}
		},
		async content(event, trigger, player) {
			const result = await player.chooseBool("是否观看技能动画？").forResult();
			if (result.bool)
				game.broadcastAll(function (player) {
					game.gl_cg("五花米线/video/家具斫木.mp4", "noskip"); //暂停游戏，不能跳过，进行特写
				}, player);
			/*if (!game.checkResult_qlzhuomu) {
				game.checkResult_qlzhuomu = game.checkResult;
				game.checkResult = function () {
					const targets = game.players.filter(i => i.isNoPlayer_qlzhuomu);
					game.players.removeArray(targets);
					game.checkResult_qlzhuomu();
					game.players.addArray(targets);
				};
			}
			if (!game.checkOnlineResult_qlzhuomu) {
				game.checkOnlineResult_qlzhuomu = game.checkOnlineResult;
				game.checkOnlineResult = function (player) {
					game.players.removeArray(targets);
					game.checkOnlineResult_qlzhuomu(player);
					game.players.addArray(targets);
				};
			}*/
			if (!get.attitude_qlzhuomu) {
				get.attitude_qlzhuomu = get.attitude;
				get.attitude = function (from = {}, to = {}) {
					if (from?.getStorage("qlzhuomu_source", false)) {
						from = from.getStorage("qlzhuomu_source", false);
					}
					if (to?.getStorage("qlzhuomu_source", false)) {
						to = to.getStorage("qlzhuomu_source", false);
					}
					let att = get.attitude_qlzhuomu(from, to);
					return att;
				};
			}
			const { target } = await player.ql_addPlayer(player, "qlmoxingta", void 0, event.cost_data.control == "下家").forResult();
			//const target = await game.addPlayerOL(player, "qlmoxingta", null, event.cost_data.control == "下家");
			target.isNoPlayer_qlzhuomu = true;
			target.dieAfter = function () { };
			target.dieAfter2 = function () { };
			target.setStorage("qlzhuomu_source", player);
			target.ai.modAttitudeFrom = function (from, to, att) {
				if (_status.qlzhuomu_source_att_ing) return att;
				if (from.getStorage("qlzhuomu_source", false)) {
					from = from.getStorage("qlzhuomu_source", false);
				}
				if (to.getStorage("qlzhuomu_source", false)) {
					to = to.getStorage("qlzhuomu_source", false);
				}
				_status.qlzhuomu_source_att_ing = true;
				att = get.attitude(from, to);
				delete _status.qlzhuomu_source_att_ing;
				return att;
			};
			//target.directgain(get.cards(4));
			/*target
				.when({ global: "dieAfter" })
				.filter((evt, player2) => {
					if (evt.reserveOut) return false;
					return evt.player == player || evt.player == player2;
				})
				.assign({
					forceDie: true,
				})
				.step(lib.skill[event.name].dieRemove);*/
			player.setStorage(event.name + "_banned", trigger?.qlzhuomu_useed?.[player.playerid] ? 2 : 3);
			player.addSkill(event.name + "_banned");
			if (trigger?.qlzhuomu_useed?.[player.playerid]) {
				player.markSkill("qlzhuomu_banned");
			}
		},
		async dieRemove(event, trigger, player) {
			if (_status.roundStart == player) _status.roundStart = player.next;
			if (lib.playerOL) delete lib.playerOL[player.playerid];
			game.broadcastAll(player => {
				game.players.remove(player);
				game.dead.remove(player);
				if (player.seatNum == 1) player.nextSeat.setSeatNum(1);
				player.nextSeat.previousSeat = player.previousSeat;
				player.previousSeat.nextSeat = player.nextSeat;
				player.delete();
				player.removed = true;
				setTimeout(() => player.removeAttribute("style"), 500);
			}, player);
			game.broadcastAll(() => {
				ui.arena.setNumber(game.players.concat(game.dead).length);
				let SeatNumStart = game.players.concat(game.dead).find(current => current.seatNum == 1);
				let pos = 0,
					target = game.me.nextSeat;
				for (let x = 0; x < game.countPlayer2(null, true); x++) {
					if (target == game.me) break;
					pos++;
					target.dataset.position = pos;
					target = target.nextSeat;
				}
				if (SeatNumStart) {
					let SeatNum = 1,
						Seat = SeatNumStart;
					for (let i = 0; i < game.countPlayer2(null, true); i++) {
						SeatNum++;
						Seat = Seat.nextSeat;
						if (Seat == SeatNumStart) break;
						Seat.setSeatNum(SeatNum);
					}
				}
			});
		},
		subSkill: {
			banned: {
				charlotte: true,
				init(player, skill) {
					player.addSkillBlocker(skill);
				},
				onremove(player, skill) {
					player.removeSkillBlocker(skill);
				},
				skillBlocker(skill, player) {
					return skill == "qlzhuomu";
				},
				silent: true,
				intro: { content: "$轮后技能恢复" },
				trigger: { global: "roundStart" },
				async content(event, trigger, player) {
					player.removeMark(event.name, 1, false);
					if (!player.hasMark(event.name)) {
						player.removeSkill(event.name);
						if (!trigger.qlzhuomu_useed) {
							trigger.qlzhuomu_useed = {};
						}
						trigger.qlzhuomu_useed[player.playerid] = true;
					}
				},
			},
		},
	},
	qlgongming: {
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		filter(event, player) {
			return lib.skill.qlgongming.logTarget(event, player)?.length;
		},
		logTarget(trigger, player) {
			return game.filterPlayer(current => !player.getStorage("qlgongming_mark").includes(current)).sortBySeat();
		},
		async content(event, trigger, player) {
			for (const target of event.targets) {
				let list = [];
				if (player.isDamaged()) {
					list.push("回复体力");
				}
				list.push("摸牌");
				if (target.hp >= 1) {
					list.push("背水！");
				}
				let control;
				if (list.length == 1) {
					control == list[0];
				} else {
					control = await target
						.chooseControl(list)
						.set("prompt", "共鸣：令" + get.translation(player) + "回复一点体力或摸两张牌")
						.set("ai", () => {
							const event = get.event();
							const att = get.attitude(get.player(), get.event().sourcex);
							if (att > 4 && get.player().hp > 1 && event.controls.length > 2) {
								return "背水！";
							}
							return event.controls[0];
						})
						.set("sourcex", player)
						.forResult("control");
				}
				game.log(target, "选择了", "#y" + control);
				if (control == "回复体力" || control == "背水！") {
					await player.recover();
				}
				if (control == "摸牌" || control == "背水！") {
					await player.draw(2);
				}
				if (control == "背水！") {
					await target.loseHp();
				}
			}
		},
		group: ["qlgongming_mark", "qlgongming_die"],
		subSkill: {
			die: {
				trigger: { global: "die" },
				forced: true,
				filter(event, player) {
					return !player.getStorage("qlgongming_mark").includes(event.player);
				},
				async content(event, trigger, player) {
					const targets = game.filterPlayer(current => current == player || current.getStorage("qlzhuomu_source") == player).sortBySeat();
					await game.asyncDraw(targets, 3);
					if (targets.length > 1) {
						const result = await player
							.chooseTarget("共鸣：令一名你召唤的“模型塔”的〖拟形〗每回合最大可发动次数+1", true, (c, player, target) => {
								return (get.event().targetsx || []).includes(target);
							})
							.set(
								"targetsx",
								targets.filter(i => i != player)
							).forResult();
						const target = result?.targets[0] || targets.filter(i => i != player).randomGet();
						if (!target) return;
						player.line(target);
						target.addMark("qlnixing", 1, false);
					}
				},
			},
			mark: {
				trigger: {
					global: "phaseBefore",
					player: ["enterGame", "changeSkillsEnd"],
				},
				filter: function (event, player) {
					if (event.name == "changeSkills") {
						return event.addSkill.includes("qlgongming");
					}
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				async content(event, trigger, player) {
					player.markAuto(event.name, game.filterPlayer2(null, true));
				},
			},
		},
	},
	qlnixing: {
		enable: "chooseToUse",
		usable(skill, player) {
			return 1 + player.countMark(skill);
		},
		intro: {
			content: "此技能每回合可额外发动#次",
		},
		filter(event, player) {
			const source = player.getStorage("qlzhuomu_source", false);
			if (event.type == "wuxie") {
				return false;
			}
			if (source && source.countCards("h") && player.countCards("hes")) {
				for (const name of source
					.getCards("h")
					.map(card => card.name)
					.unique()) {
					if (get.type(name) != "basic" && get.type2(name) != "trick") {
						continue;
					}
					const card = { name: name, isCard: true };
					if (event.filterCard(card, player, event)) {
						return true;
					}
					if (name == "sha") {
						for (const nature of lib.inpile_nature) {
							if (
								!source.hasCard(card => {
									return card.name == "sha" && card.nature == nature;
								}, "h")
							) {
								continue;
							}
							card.nature = nature;
							if (event.filterCard(card, player, event)) {
								return true;
							}
						}
					}
				}
			}
			if (event.type == "phase") {
				return player.countCards("he") >= 2 && game.countPlayer() > 1;
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				const dialog = ui.create.dialog("拟形"),
					source = player.getStorage("qlzhuomu_source", false),
					list = [],
					cards = [];
				dialog.direct = true;
				if (event.type == "phase" && player.countCards("he") >= 2) {
					dialog.add([[["discard", "弃置两张牌并选择..."]], "tdnodes"]);
				}
				if (source && source.countCards("h")) {
					const names = source
						.getCards("h")
						.map(card => card.name)
						.unique();
					for (const name of names) {
						if (get.type(name) != "basic" && get.type2(name) != "trick") {
							continue;
						}
						if (event.filterCard(get.autoViewAs({ name }, "unsure"), player, event) && (name != "sha" || player.hasCard(card => card.name == "sha" && !card.nature, "h"))) {
							cards.push([get.type2(name), "", name]);
						}
						if (name == "sha") {
							for (const nature of lib.inpile_nature) {
								if (
									!source.hasCard(card => {
										return card.name == "sha" && card.nature == nature;
									}, "h")
								) {
									continue;
								}
								if (event.filterCard(get.autoViewAs({ name, nature }, "unsure"), player, event)) {
									cards.push(["basic", "", "sha", nature]);
								}
							}
						}
					}
					if (cards.length) {
						dialog.addText("转化卡牌");
						dialog.add([cards, "vcard"]);
					}
				}
				return dialog;
			},
			check(button, player) {
				if (typeof button.link == "string") {
					return 0.1;
				}
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				return _status.event.player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
				});
			},
			backup(links, player) {
				const isUse = links[0] !== "discard";
				const backup = get.copy(lib.skill["qlnixing_" + (isUse ? "use" : "discard")]);
				if (isUse) {
					const card = links[0];
					backup.viewAs = { name: card[2], nature: card[3], isCard: true };
				}
				return backup;
			},
			prompt(links, player) {
				const isUse = links[0] !== "discard";
				return isUse ? "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用" : "###拟形###弃置两张牌并选择等量名任意相邻角色对这些角色依次造成一点伤害";
			},
		},
		hiddenCard(player, name) {
			const source = player.getStorage("qlzhuomu_source", false);
			if (source && source.countCards("h")) {
				return source.hasCard(card => card.name == name, "h");
			}
		},
		ai: {
			respondSha: true,
			respondShan: true,
			save: true,
			order(item, player) {
				if (_status.event.type == "phase") {
					return 7.1;
				}
				return 4;
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			backup: {},
			use: {
				filterCard: () => true,
				position: "hes",
				popname: true,
			},
			discard: {
				filterCard: true,
				selectCard: 2,
				allowChooseAll: true,
				position: "he",
				delay: false,
				filterTarget(card, player, target) {
					if (!ui.selected?.targets?.length) return true;
					return target == ui.selected.targets[0].getNext() || target == ui.selected.targets[0].getPrevious();
				},
				selectTarget: 2,
				prompt(event) {
					return "弃置两张牌并选择等量名任意相邻角色对这些角色依次造成一点伤害";
				},
				ai1(card) {
					return 7 - get.value(card);
				},
				async content(event, trigger, player) {
					await event.target.damage();
				},
				ai2(target) {
					return get.damageEffect(target, get.player(), get.player());
				},
			},
		},
	},
	qlshenghui: {
		mod: {
			playerEnabled(card, player, target) {
				if (target.hasSkill("qlfaxiang")) return false;
			},
		},
		trigger: {
			player: "dying",
		},
		forced: true,
		locked: true,
		content() {
			player.removeSkill(event.name);
		},
		_priority: 0,
		intro: {
			content() {
				return get.translation(skill + "_info");
			},
		},
	},
	qlguanxing: {
		audio: "dcjincui",
		audioname: ["jiangwei", "re_jiangwei", "re_zhugeliang", "ol_jiangwei"],
		audioname2: {
			gexuan: "guanxing_gexuan",
		},
		trigger: {
			player: ["phaseZhunbeiBegin", "phaseJieshuBegin"],
		},
		superCharlotte: true,
		fixed: true,
		frequent: true,
		filter(event, player, name) {
			if (name == "phaseJieshuBegin") {
				return player.hasSkill("qlguanxing_on");
			}
			return true;
		},
		async content(event, trigger, player) {
			const result = await player.chooseToGuanxing(6).set("prompt", "观星：点击或拖动将牌移动到牌堆顶或牌堆底").forResult();
			if ((!result.bool || !result.moved[0].length) && event.triggername == "phaseZhunbeiBegin") {
				player.addTempSkill(["qlguanxing_on", "guanxing_fail"]);
			}
		},
		subSkill: {
			on: {
				//superCharlotte: true,
				charlotte: true,
				//fixed:true,
				sub: true,
				sourceSkill: "qlguanxing",
				_priority: 0,
			},
		},
		ai: {
			guanxing: true,
		},
		_priority: 0,
		/*intro: {
			content() {
				return get.translation(skill + "_info");
			},
		},*/
	},
	qlweiye: {
		trigger: {
			source: "dieAfter",
		},
		superCharlotte: true,
		charlotte: true,
		fixed: true,
		async content(event, trigger, player) {
			await player.gainMaxHp();
			var players = game.players.slice(0).sortBySeat();
			await player.line(players);
			for (var i = 0; i < players.length; i++) {
				if (players[i] != player) players[i].damage();
			}
			player.insertPhase();
		},
		_priority: 0,
		intro: {
			content() {
				return get.translation(skill + "_info");
			},
		},
	},
	qlguose: {
		audio: "dcqiqin",
		enable: "phaseUse",
		superCharlotte: true,
		fixed: true,
		charlotte: true,
		discard: false,
		lose: false,
		delay: false,
		filter(event, player) {
			return player.countCards("hes", { suit: "diamond" }) > 0;
		},
		position: "hes",
		filterCard: {
			suit: "diamond",
		},
		filterTarget(card, player, target) {
			if (get.position(ui.selected.cards[0]) != "s" && lib.filter.cardDiscardable(ui.selected.cards[0], player, "qlguose") && target.hasJudge("lebu")) {
				return true;
			}
			if (player == target) {
				return false;
			}
			if (!game.checkMod(ui.selected.cards[0], player, "unchanged", "cardEnabled2", player)) {
				return false;
			}
			return player.canUse({ name: "lebu", cards: ui.selected.cards }, target);
		},
		check(card) {
			return 7 - get.value(card);
		},
		content() {
			if (target.hasJudge("lebu")) {
				player.discard(cards);
				target.discard(target.getJudge("lebu"));
			} else {
				player.useCard({ name: "lebu" }, target, cards).audio = false;
			}
			player.draw();
		},
		ai: {
			result: {
				target(player, target) {
					if (target.hasJudge("lebu")) {
						return -get.effect(target, { name: "lebu" }, player, target);
					}
					return get.effect(target, { name: "lebu" }, player, target);
				},
			},
			order: 9,
		},
		_priority: 0,
	},
	qlguicai: {
		audio: "dcsbpingliao",
		audioname: ["new_simayi"],
		trigger: {
			global: "judge",
		},
		superCharlotte: true,
		charlotte: true,
		fixed: true,
		direct: true,
		filter(event, player) {
			return player.countCards("hes") > 0;
		},
		content() {
			"step 0";
			player
				.chooseCard(get.translation(trigger.player) + "的" + (trigger.judgestr || "") + "判定为" + get.translation(trigger.player.judging[0]) + "，" + get.prompt("qlguicai"), "hes", function (card) {
					var player = _status.event.player;
					var mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (mod2 != "unchanged") {
						return mod2;
					}
					var mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
					if (mod != "unchanged") {
						return mod;
					}
					return true;
				})
				.set("ai", function (card) {
					var trigger = _status.event.getTrigger();
					var player = _status.event.player;
					var judging = _status.event.judging;
					var result = trigger.judge(card) - trigger.judge(judging);
					var attitude = get.attitude(player, trigger.player);
					let val = get.value(card);
					if (get.subtype(card) == "equip2") {
						val /= 2;
					} else {
						val /= 4;
					}
					if (attitude == 0 || result == 0) {
						return 0;
					}
					if (attitude > 0) {
						return result - val;
					}
					return -result - val;
				})
				.set("judging", trigger.player.judging[0]);
			("step 1");
			if (result.bool) {
				player.respond(result.cards, "qlguicai", "highlight", "noOrdering");
			} else {
				event.finish();
			}
			("step 2");
			if (result.bool) {
				var card = result.cards[0];
				if (trigger.player.judging[0].clone) {
					trigger.player.judging[0].clone.classList.remove("thrownhighlight");
					game.broadcast(function (card) {
						if (card.clone) {
							card.clone.classList.remove("thrownhighlight");
						}
					}, trigger.player.judging[0]);
					game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
				}
				game.cardsDiscard(trigger.player.judging[0]);
				if (get.color(card) == "red") {
					player.recover();
				} else if (get.color(card) == "black") {
					player.draw(2, "nodelay");
				}
				trigger.player.judging[0] = result.cards[0];
				trigger.orderingCards.addArray(result.cards);
				game.log(trigger.player, "的判定牌改为", result.cards[0]);
				game.delay(2);
			}
		},
		ai: {
			rejudge: true,
			tag: {
				rejudge: 1,
			},
		},
		_priority: 0,
	},
	qlleiji: {
		group: "qlleiji_misa",
		audio: "tianjie",
		derivation: "qlleiji_faq",
		audioname: ["boss_qinglong"],
		trigger: {
			player: ["useCard", "respond"],
		},
		superCharlotte: true,
		charlotte: true,
		fixed: true,
		filter(event, player) {
			return event.card.name == "shan" || (event.name == "useCard" && event.card.name == "shandian") || (event.name == "respond" && event.card.name == "sha");
		},
		judgeCheck(card, bool) {
			var suit = get.suit(card);
			if (suit == "spade") {
				if (bool && get.number(card) > 1 && get.number(card) < 10) {
					return 5;
				}
				return 4;
			}
			if (suit == "club") {
				return 2;
			}
			return 0;
		},
		content() {
			player.judge(lib.skill.qlleiji.judgeCheck).judge2 = function (result) {
				return result.bool ? true : false;
			};
		},
		ai: {
			useShan: true,
			effect: {
				target_use(card, player, target, current) {
					let name;
					if (typeof card == "object") {
						if (card.viewAs) {
							name = card.viewAs;
						} else {
							name = get.name(card);
						}
					}
					if (
						name == "shandian" ||
						(get.tag(card, "respondShan") &&
							!player.hasSkillTag(
								"directHit_ai",
								true,
								{
									target: target,
									card: card,
								},
								true
							))
					) {
						let club = 0,
							spade = 0;
						if (
							game.hasPlayer(function (current) {
								return get.attitude(target, current) < 0 && get.damageEffect(current, target, target, "thunder") > 0;
							})
						) {
							club = 2;
							spade = 4;
						}
						if (!target.isHealthy()) {
							club += 2;
						}
						if (!club && !spade) {
							return 1;
						}
						if (name === "sha") {
							if (!target.mayHaveShan(player, "use")) {
								return;
							}
						} else if (!target.mayHaveShan(player)) {
							return 1 - 0.1 * Math.min(5, target.countCards("hs"));
						}
						if (!target.hasSkillTag("rejudge")) {
							return [1, (club + spade) / 4];
						}
						let pos = player == target || player.hasSkillTag("viewHandcard", null, target, true) ? "hes" : "e",
							better = club > spade ? "club" : "spade",
							max = 0;
						target.hasCard(function (cardx) {
							if (get.suit(cardx) == better) {
								max = 2;
								return true;
							}
							if (spade && get.color(cardx) == "black") {
								max = 1;
							}
						}, pos);
						if (max == 2) {
							return [1, Math.max(club, spade)];
						}
						if (max == 1) {
							return [1, Math.min(club, spade)];
						}
						if (pos == "e") {
							return [1, Math.min((Math.max(1, target.countCards("hs")) * (club + spade)) / 4, Math.max(club, spade))];
						}
						return [1, (club + spade) / 4];
					}
				},
				target(card, player, target) {
					if (name == "lebu" || name == "bingliang") {
						return [target.hasSkillTag("rejudge") ? 0.4 : 1, 2, target.hasSkillTag("rejudge") ? 0.4 : 1, 0];
					}
				},
			},
		},
		_priority: 0,
		intro: {
			content() {
				return get.translation(skill + "_info");
			},
		},
	},
	qlleiji_misa: {
		audio: "xinleiji",
		trigger: {
			player: "judgeEnd",
		},
		direct: true,
		disableReason: ["暴虐", "助祭", "弘仪", "孤影"],
		sourceSkill: "qlleiji",
		superCharlotte: true,
		charlotte: true,
		fixed: true,
		filter(event, player) {
			return !lib.skill.qlleiji_misa.disableReason.includes(event.judgestr) && ["spade", "club"].includes(event.result.suit);
		},
		content() {
			"step 0";
			event.num = 1 + ["club", "spade"].indexOf(trigger.result.suit);
			event.logged = false;
			if (event.num == 1 && player.isDamaged()) {
				event.logged = true;
				player.logSkill("qlleiji");
				player.recover();
			}
			player
				.chooseTarget("雷击：是否对一名角色造成" + event.num + "点雷电伤害？")
				.set("ai", target => {
					const player = _status.event.player;
					let eff = get.damageEffect(target, player, target, "thunder");
					if (
						get.event().num > 1 &&
						!target.hasSkillTag("filterDamage", null, {
							player: player,
							card: null,
							nature: "thunder",
						})
					) {
						if (eff > 0) {
							eff -= 25;
						} else if (eff < 0) {
							eff *= 2;
						}
					}
					return eff * get.attitude(player, target);
				})
				.set("num", event.num);
			("step 1");
			if (result.bool && result.targets && result.targets.length) {
				if (!event.logged) {
					player.logSkill("qlleiji", result.targets);
				} else {
					player.line(result.targets, "thunder");
				}
				result.targets[0].damage(event.num, "thunder");
			}
		},
		_priority: 0,
	},
	qlxianfu: {
		trigger: {
			global: "gameStart",
		},
		audio: "ext:五花米线/audio/skill:2",
		superCharlotte: true,
		charlotte: true,
		fixed: true,
		qiuli: true,
		forced: true,
		content: function () {
			"step 0";
			player.chooseTarget(true);
			("step 1");
			player.addSkills(["qltianming", "qlyuanlue"]);
			result.targets[0].addSkills(["qlxianfu_mark", "qltianming", "qlyuanlue"]);
		},
		group: ["qlxianfu_achieve", "qlxianfu_fail"],
		subSkill: {
			mark: {
				superCharlotte: true,
				mark: true,
				intro: {
					content: "先辅角色",
				},
				sub: true,
				sourceSkill: "qlxianfu",
				_priority: 0,
			},
			achieve: {
				trigger: {
					global: "dieAfter",
				},
				superCharlotte: true,
				filter: function (event) {
					return event.source && event.source.hasSkill("qlxianfu_mark") && event.source.countMark("finish") == 0;
				},
				forced: true,
				skillAnimation: true,
				animationColor: "water",
				audio: "ext:五花米线/audio/skill:2",
				content: function () {
					player.awakenSkill(event.name);
					game.log(player, "成功完成使命");
					player.chooseToGive(Math.ceil(player.countCards("h") / 2), trigger.source);
					var list = [];
					list.push("qlweiye");
					if (trigger.source.hasSkill("qlguanxing") && trigger.source.hasSkill("oltiaoxin")) {
						list.push("olhuoji");
					}
					if (trigger.source.hasSkill("qlguose") && trigger.source.hasSkill("sbjiang")) {
						list.push("drlt_poxi");
					}
					if (trigger.source.hasSkill("qlguicai") && trigger.source.hasSkill("quhu")) {
						list.push("dcmingfa");
					}
					if (trigger.source.hasSkill("qlleiji") && trigger.source.hasSkill("spzhengjun")) {
						list.push("xinjianying");
					}
					trigger.source.addSkill(list);
					trigger.source.addMark("finish");
				},
				sub: true,
				sourceSkill: "qlxianfu",
				_priority: 0,
			},
			fail: {
				trigger: {
					global: "die",
				},
				audio: "ext:五花米线/audio/skill:2",
				superCharlotte: true,
				filter: function (event) {
					return event.player.hasSkill("qlxianfu_mark");
				},
				forced: true,
				skillAnimation: true,
				animationColor: "water",
				content: function () {
					player.awakenSkill(event.name);
					game.log(player, "使命失败");
					player.removeSkills(["faxiang_zb", "faxiang_judge", "faxiang_draw", "faxiang_discard", "faxiang_js"]);
					player.gainMaxHp(6 - player.maxHp);
					player.addSkills(["qlweiye", "xinjianying", "olhuoji", "drlt_poxi", "dcmingfa"]);
				},
				sub: true,
				sourceSkill: "qlxianfu",
				_priority: 0,
			},
		},
		_priority: 0,
	},
	qltianming: {
		trigger: {
			target: "useCardToTargeted",
		},
		superCharlotte: true,
		filter(event, player) {
			if (!get.tag(event.card, "damage")) return false;
			return true;
		},
		content() {
			"step 0";
			player.chooseToDiscard(2, true, "he");
			player.draw(3);
		},
		ai: {
			effect: {
				target_use(card, player, target, current) {
					if (card.name == "sha") return [1, 0.5];
				},
			},
		},
		_priority: 0,
		intro: {
			content() {
				return get.translation(skill + "_info");
			},
		},
	},
	qlyuanlue: {
		trigger: {
			player: "phaseJieshuBegin",
		},
		superCharlotte: true,
		filter: function (event, player) {
			return true;
		},
		forced: true,
		locked: true,
		preHidden: true,
		async content(event, trigger, player) {
			if (!player.isMinHp()) {
				player.draw(3);
			} else {
				player.draw(2);
			}
		},
		_priority: 0,
		intro: {
			content() {
				return get.translation(skill + "_info");
			},
		},
	},
	qlfaxiang: {
		group: ["qlfaxiang_gain", "qlfaxiang_up", "qlfaxiang_buff"],
		subSkill: {
			buff: {
				trigger: {
					global: "phaseBefore",
					player: ["gainMaxHpBegin", "loseMaxHpBegin", "enterGame"],
				},
				audio: "ext:五花米线/audio/skill:2",
				forced: true,
				persevereSkill: true,
				superCharlotte: true,
				qiuli: true,
				filter(event, player) {
					let list = ["qlfaxiang_zb", "qlfaxiang_judge", "qlfaxiang_draw", "qlfaxiang_discard", "qlfaxiang_js"];
					var num = 0;
					for (let i in list) {
						if (player.hasSkill(list[i])) {
							num++;
						}
					}
					let bool = player.maxHp !== 6 - num;
					if (event.name === "phase") return bool && game.phaseNumber === 0;
					return true;
				},
				async content(event, trigger, player) {
					let list = ["qlfaxiang_zb", "qlfaxiang_judge", "qlfaxiang_draw", "qlfaxiang_discard", "qlfaxiang_js"];
					var num = 0;
					for (let i in list) {
						if (player.hasSkill(list[i])) {
							num++;
						}
					}
					if (["gainMaxHp", "loseMaxHp"].includes(trigger.name)) {
						trigger.cancel();
						player.maxHp = 6 - num;
						player.update();
					} else {
						player.maxHp = 6 - num;
						player.update();
					}
				},
				sub: true,
				sourceSkill: "qlfaxiang",
				_priority: 0,
			},
			up: {
				trigger: {
					player: "dieBegin",
				},
				audio: "ext:五花米线/audio/skill:2",
				superCharlotte: true,
				forced: true,
				persevereSkill: true,
				qiuli: true,
				filter(event, player) {
					if (!(event.getParent().name !== "giveup" && player.maxHp > 0)) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					if (trigger.source) await trigger.source.addSkill("qlshenghui");
					let list = ["qlfaxiang_zb", "qlfaxiang_judge", "qlfaxiang_draw", "qlfaxiang_discard", "qlfaxiang_js"];
					event.list = list;
					event.choose = true;
					for (let i in list) {
						if (player.hasSkill(list[i])) {
							event.choose = true;
							break;
						} else event.choose = false;
					}
					if (event.choose) {
						let list2 = ["qlfaxiang_zb", "qlfaxiang_judge", "qlfaxiang_draw", "qlfaxiang_discard", "qlfaxiang_js"];
						let list1 = [];
						for (let i in list2) {
							if (player.hasSkill(list2[i])) {
								list1.push(list2[i]);
							}
						}
						const result = await player.chooseControl(list1, true).forResult();
						if (result.control) {
							await player.removeSkill(result.control);
							await player.gainMaxHp();
							await player.recoverTo(player.maxHp);
							await player.changeHp(4444);
							trigger.cancel();
						}
					} else {
						await player.recoverTo(player.maxHp);
						await player.changeHp(4444);
						await player.draw(4);
						trigger.cancel();
						let count = 0;
						var players = game.players.slice(0).sortBySeat();
						while (count < 100 && player.getNext != player) {
							/*await player.line(players);*/
							for (var i = 0; i < players.length; i++) {
								if (players[i] != player) {
									await players[i].damage(4444);
									await players[i].die();
								}
							}
						}
						await player.removeSkill("qlfaxiang");
						return;
					}
				},
				sub: true,
				sourceSkill: "qlfaxiang",
				_priority: 0,
			},
			gain: {
				trigger: {
					global: "gameStart",
				},
				audio: "ext:五花米线/audio/skill:2",
				superCharlotte: true,
				forced: true,
				persevereSkill: true,
				qiuli: true,
				content: function () {
					player.addSkills(["qlfaxiang_zb", "qlfaxiang_judge", "qlfaxiang_draw", "qlfaxiang_discard", "qlfaxiang_js"]);
				},
				popup: false,
				sub: true,
				sourceSkill: "qlfaxiang",
				_priority: 1,
			},
			zb: {
				trigger: {
					player: "phaseZhunbeiBefore",
				},
				forced: true,
				persevereSkill: true,
				content() {
					trigger.cancel();
				},
				popup: false,
				sub: true,
				sourceSkill: "qlfaxiang",
				_priority: 0,
			},
			judge: {
				trigger: {
					player: "phaseJudgeBefore",
				},
				forced: true,
				persevereSkill: true,
				content() {
					trigger.cancel();
				},
				popup: false,
				sub: true,
				sourceSkill: "qlfaxiang",
				_priority: 0,
			},
			draw: {
				trigger: {
					player: "phaseDrawBefore",
				},
				forced: true,
				persevereSkill: true,
				content() {
					trigger.cancel();
				},
				popup: false,
				sub: true,
				sourceSkill: "qlfaxiang",
				_priority: 0,
			},
			discard: {
				trigger: {
					player: "phaseDiscardBefore",
				},
				forced: true,
				persevereSkill: true,
				content() {
					trigger.cancel();
				},
				popup: false,
				sub: true,
				sourceSkill: "qlfaxiang",
				_priority: 0,
			},
			js: {
				trigger: {
					player: "phaseJieshuBefore",
				},
				forced: true,
				persevereSkill: true,
				content() {
					trigger.cancel();
				},
				popup: false,
				sub: true,
				sourceSkill: "qlfaxiang",
				_priority: 0,
			},
		},
		trigger: {
			player: ["phaseZhunbeiBegin", "phaseJudgeBegin", "phaseDrawBegin", "phaseUseBegin", "phaseDiscardBegin", "phaseJieshuBegin"],
		},
		audio: "ext:五花米线/audio/skill:2",
		superCharlotte: true,
		forced: true,
		persevereSkill: true,
		fixed: true,
		qiuli: true,
		derivation: ["qlleiji", "qlguose", "qlguicai", "qlguanxin", "shenghui"],
		async content(event, trigger, player) {
			let check,
				str = ["准备", "判定", "摸牌", "出牌", "弃牌", "结束"][lib.skill.qlfaxiang.trigger.player.indexOf(trigger.name + "Begin")];
			str += "阶段：是否弃置一张牌令一名角色获得对应技能？";
			await player.draw();
			const result = await player.chooseCardTarget().set("prompt", str).set("position", "hes").forResult();
			if (result.bool) {
				var card = result.cards[0];
				var suit = get.suit(card);
				var target = result.targets[0];
				await player.discard(card);
				player.line(target);
				switch (suit) {
					case "heart":
						audio: ("dcjincui", target.hasSkill("qlguanxing") ? target.addSkill("oltiaoxin") : target.addSkill("qlguanxing"));
						break;
					case "diamond":
						audio: ("dcqiqin", target.hasSkill("qlguose") ? target.addSkill("sbjiang") : target.addSkill("qlguose"));
						break;
					case "club":
						audio: ("dcsbpingliao", target.hasSkill("qlguicai") ? target.addSkill("quhu") : target.addSkill("qlguicai"));
						break;
					case "spade":
						audio: ("tianjie", target.hasSkill("qlleiji") ? target.addSkill("spzhengjun") : target.addSkill("qlleiji"));
						break;
				}
			}
		},
		_priority: 0,
	},
	qlmeiying: {
		charlotte: true,
		superCharlotte: true,
		fixed: true,
		group: ["qlmeiying_juejing", "qlmeiying_club", "qlmeiying_faxiang"],
		subSkill: {
			juejing: {
				mod: {
					aiOrder(player, card, num) {
						if (num > 0) {
							return num;
						}
						if (card.name === "zhuge" && player.getCardUsable("sha", true) < 6) {
							return 1;
						}
					},
					aiValue(player, card, num) {
						if (card.name === "zhuge") {
							return 60 / (1 + player.getCardUsable("sha", true));
						}
					},
					aiUseful(player, card, num) {
						if (card.name === "zhuge") {
							return 60 / (1 + player.getCardUsable("sha", true));
						}
					},
				},
				trigger: {
					player: ["loseAfter", "changeHp", "gainMaxHpAfter", "loseMaxHpAfter", "changeSkillsAfter"],
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				audio: "fanghun",
				forced: true,
				charlotte: true,
				superCharlotte: true,
				fixed: true,
				filter(event, player) {
					const num2 = player.getDamagedHp();
					if (event.name == "gain" && event.player == player) {
						return player.countCards("h") > num2;
					}
					if (event.getl && !event.getl(player)) {
						return false;
					}
					if (player.countCards("h") == num2) {
						return false;
					}
					var evt = event;
					for (var i = 0; i < num2; i++) {
						evt = evt.getParent("qlmeiying");
						if (evt.name != "qlmeiying") {
							return true;
						}
					}
					return false;
				},
				content() {
					const num2 = player.getDamagedHp();
					var num = num2 - player.countCards("h");
					if (num > 0) {
						player.draw(num);
					} else {
						player.chooseToDiscard("h", true, -num);
					}
				},
				ai: {
					freeSha: true,
					freeJiu: true,
					skillTagFilter() {
						return true;
					},
				},
				sub: true,
				sourceSkill: "qlmeiying",
				_priority: 0,
			},
			club: {
				mod: {
					aiOrder(player, card, num) {
						if (num <= 0 || !player.isPhaseUsing() || player.needsToDiscard() < 2) {
							return num;
						}
						let suit = get.suit(card, player);
						if (suit === "club") {
							return num - 5.4;
						}
					},
					aiValue(player, card, num) {
						if (num <= 0) {
							return num;
						}
						let suit = get.suit(card, player);
						if (suit === "club") {
							return num + 5.4;
						}
					},
					aiUseful(player, card, num) {
						if (num <= 0) {
							return num;
						}
						let suit = get.suit(card, player);
						if (suit === "heart") {
							return num + 4;
						}
					},
				},
				enable: "chooseToUse",
				audio: "fanghun",
				charlotte: true,
				superCharlotte: true,
				fixed: true,
				filter(event, player) {
					if (!event.filterCard(get.autoViewAs({ name: "jiu" }, "unsure"), player, event) && !event.filterCard(get.autoViewAs({ name: "wuxie" }, "unsure"), player, event)) {
						return false;
					}
					return true;
				},
				chooseButton: {
					dialog(event, player) {
						var list = [];
						if (event.filterCard(get.autoViewAs({ name: "jiu" }, "unsure"), player, event)) {
							list.push(["基本", "", "jiu"]);
						}
						if (event.filterCard(get.autoViewAs({ name: "wuxie" }, "unsure"), player, event)) {
							list.push(["锦囊", "", "wuxie"]);
						}
						const dialog = ui.create.dialog("梅影", [list, "vcard"]);
						dialog.direct = true;
						return dialog;
					},
					backup(links, player) {
						return {
							filterCard(card, player) {
								return get.suit(card) == "club";
							},
							position: "he",
							precontent() {
								player.logSkill("qlmeiying");
								event.getParent().addCount = false;
							},
							log: false,
							popname: true,
							viewAs: {
								name: links[0][2],
							},
						};
					},
					prompt(links) {
						return "将一张梅花牌当做【" + get.translation(links[0][2]) + "】使用";
					},
				},
				hiddenCard(player, name) {
					if (name == "wuxie" && _status.connectMode && player.countCards("hes") > 0) {
						return true;
					}
					if (name == "wuxie") {
						return player.countCards("hes", { suit: "club" }) > 0;
					}
					if (name == "jiu") {
						return player.countCards("hes", { suit: "club" }) > 0;
					}
				},
				ai: {
					order: 3,
					respondJiu: true,
					respondWuxie: true,
					skillTagFilter(player) {
						if (!player.countCards("hes", { suit: "club" })) {
							return false;
						}
					},
				},
				sub: true,
				sourceSkill: "qlmeiying",
				_priority: 0,
			},
			faxiang: {
				trigger: {
					player: ["loseMaxHpBegin", "changeSkillsAfter"],
				},
				forced: true,
				locked: true,
				charlotte: true,
				superCharlotte: true,
				fixed: true,
				audio: "fanghun",
				filter: function (event, player) {
					var skills = player.getSkills(null, false, false).filter(function (i) {
						var info = get.info(i);
						return info && !info.charlotte;
					});
					return player.maxHp <= skills.length;
				},
				async content(event, trigger, player) {
					var skills = player.getSkills(null, false, false).filter(function (i) {
						var info = get.info(i);
						return info && !info.charlotte;
					});
					if (trigger.name == "loseMaxHp") {
						trigger.cancel();
					}
					player.maxHp = skills.length;
					player.update();
				},
				sub: true,
				sourceSkill: "qlmeiying",
				_priority: 20,
			},
		},
		_priority: 0,
	},
	qlfuhan: {
		audio: "fuhan",
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		limited: true,
		forced: true,
		locked: true,
		skillAnimation: true,
		animationColor: "orange",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			let list;
			list = [
				"sp_sunshangxiang",
				"old_madai",
				"re_masu",
				"re_fazheng",
				"re_zhangyi",
				"re_menghuo",
				"re_machao",
				"re_zhaoyun",
				"re_baosanniang",
				"re_liaohua",
				"re_pangtong",
				"re_weiyan",
				"re_zhurong",
				"lvkai",
				"furong",
				"jianyong",
				"wangping",
				"xiahouba",
				"zhangsong",
				"zhangxingcai",
				"xiahoushi",
				"mayunlu",
				"yangyi",
				"guanyinping",
				"sunqian",
				"lifeng",
				"dongyun",
				"zhaotongzhaoguang",
				"dc_huanghao" /*"qlfazheng",
	"qlxiahoushi","qlzhoucang","qlhuangzhong","qlweiyan","qlsunshangxiang",*/,
			];
			/*if (_status.characterlist) {
list = [];
for (let i = 0; i < _status.characterlist.length; i++) {
	var name = _status.characterlist[i];
	if (lib.character[name][1] == "shu") {
		list.push(name);
	}
}
} else if (_status.connectMode) {
list = get.charactersOL(function (i) {
	return lib.character[i][1] != "shu";
});
} else {
list = get.gainableCharacters(function (info) {
	return info[1] == "shu";
});
}*/
			var players = game.players.concat(game.dead);
			for (let i = 0; i < players.length; i++) {
				list.remove(players[i].name);
				list.remove(players[i].name1);
				list.remove(players[i].name2);
			}
			/*list.remove("xiahouba");
			list.remove("re_baosanniang");
			list.remove("zhaotongzhaoguang");*/
			const result = await player
				.chooseButton(2, true)
				.set("ai", function (button) {
					return get.rank(button.link, true) - lib.character[button.link][2];
				})
				.set("createDialog", ["获得两名角色全部技能", [list.randomGets(10), "character"]])
				.forResult();
			if (result?.links?.length) {
				const result2 = await player.chooseBool("是否观看技能动画？").forResult();
				if (result2.bool)
					/*game.broadcastAll(function (player) {
						game.gl_cg("五花米线/video/赵襄扶汉.mp4", "noskip"); //暂停游戏，不能跳过，进行特写
					}, player);*/
					player.videoPlay("a", "赵襄扶汉");
				for (var i = 0; i < 2; i++) {
					await player.addSkills(lib.character[result.links[i]].skills);
					/*await player.reinitCharacter(get.character(player.name2, 3).includes("fuhan") ? player.name2 : player.name1, result.links[0]);*/
				}
			}
		},
		mark: true,
		intro: {
			content: "limited",
		},
		init: (player, skill) => (player.storage[skill] = false),
	},
	change: {
		trigger: {
			global: "phaseBefore",
			player: ["enterGame", "damageEnd", "phaseJieshuBegin"],
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		audio: "ext:五花米线/audio/skill:2",
		forced: true,
		async content(event, trigger, player) {
			var list = ["jushou", "gzduanliang", "qiaobian", "yuanhu", "kaikang", "xinzhanyi", "zhenwei", "xiaoguo", "residi", "new_retuxi", "new_reluoyi", "xinshensu", "xinjiangchi", "reqiangxi", "decadezhenjun", "rehuaiyi", "reshuangxiong", "xinxhzhiyan", "weifeng", "xinzhilve", "xinxingluan", "beizhu", "twmoukui", "reluanzhan", "xinfu_jixu", "kuangfu", "chengzhao", "xinfu_kannan", "daoji", "xinfu_qinguo", "xinyaoming", "xindanshou", "refuhai", "reanguo", "gzbuqu", "gzyinghun", "dujin", "xuanfeng", "tianyi", "kuangbi", "nzry_juzhan", "dcwanglie", "xinbenxi", "xinzhongyong", "rezhiyi", "fuman", "fuhun", "kuanggu", "shameng", "xiansi", "longyin"];
			const skill = list.randomGet();
			const result = await player.chooseTarget(`是否令一名角色获得技能${get.translation(skill)}`).forResult();
			if (result.bool) {
				const target = result.targets[0];
				player.line(target);
				if (!target.hasSkill(skill, null, false, false)) {
					await target.addSkills(skill);
				} else {
					await target.draw(2);
				}
			}
			/*var list2 = [
"bintieshuangji","guofengyupao","xuwangzhimian","zhaogujing"
];
const equip = list2.randomGet();
const result2 = await player.chooseTarget(`是否令一名角色装备${get.translation(equip)}`).forResult();
if(result2.bool){
const card = game.createCard2(equip, "heart", 12);
await result2.targets[0].gain([card], "gain2");
await result2.targets[0].chooseUseTarget(card, true, false);
}*/
		},
		_priority: 0,
	},
	qlspweiye: {
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.draw();
			const result = await player.choosePlayerCard(target, 1, "he", true, "visible").forResult();
			if (result.bool) {
				const cards = result.cards;
				await target.chooseUseTarget({ name: "wanjian" }, cards, true);
			}
		},
		_priority: 0,
	},
	qlspyongzhi: {
		audio: ["nzry_juzhan_11.mp3", "nzry_juzhan_12.mp3"],
		mark: true,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage, player, skill) {
				if (storage) {
					return "当你使用伤害时，你可以令此牌伤害+1，然后你获得此牌";
				}
				return "当你成为其他角色牌的目标后，你可以失去一点体力取消之并摸一张牌，然后你获得此牌";
			},
		},
		trigger: {
			player: "useCard",
			target: "useCardToTargeted",
		},
		filter(event, player, name) {
			if (name.includes("T")) {
				return player != event.player && event.card && !player.storage.qlspyongzhi;
			} else {
				if (!event.card || !get.tag(event.card, "damage") || !player.storage.qlspyongzhi) {
					return false;
				}
				return true;
			}
		},
		prompt2(event, player) {
			return player.storage.qlspyongzhi ? `令此牌伤害+1并于结算后获得之` : `失去一点体力取消之并摸一张牌，然后获得此牌`;
		},
		async content(event, trigger, player) {
			const card = trigger.cards;
			player.changeZhuanhuanji(event.name);
			const storage = player.storage[event.name];
			await player.loseHp();
			if (storage) {
				trigger.targets.remove(player);
			} else {
				trigger.baseDamage++;
			}
			await player.draw();
			await player.gain(card, "gain2");
		},
		_priority: 0,
	},
	qlwuwei: {
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		filter: function (event, player) {
			return event.card.name == "juedou";
		},
		async content(event, trigger, player) {
			player.gainPlayerCard(trigger.target == player ? trigger.player : trigger.target);
		},
		_priority: 0,
	},
	qljuezhan: {
		enable: ["chooseToUse"],
		filterCard(card, player) {
			lib.types = ["basic", "trick", "equip"];
			const list = player.getStorage("qljuezhan_used");
			const types = lib.types.filter(c => !list.includes(c));
			const type = get.type2(card, player);
			return types.includes(type);
		},
		position: "hes",
		viewAs: {
			name: "juedou",
			storage: {
				qljuezhan: true,
			},
		},
		popname: true,
		selectCard: 1,
		viewAsFilter(player) {
			lib.types = ["basic", "trick", "equip"];
			const list = player.getStorage("qljuezhan_used");
			const types = lib.types.filter(c => !list.includes(c));
			if (!player.hasCard(card => types.includes(get.type2(card, player)), "hes")) {
				return false;
			}
		},
		check(card) {
			const val = get.value(card);
			return 5 - val;
		},
		precontent() {
			const type2 = get.type2(event.getParent().result.cards[0]);
			player.markAuto("qljuezhan_used", [type2]);
			player.addTempSkill("qljuezhan_used");
		},
		group: "qljuezhan_effect",
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				sub: true,
				sourceSkill: "qljuezhan",
				_priority: 0,
			},
			effect: {
				trigger: {
					player: "useCard",
				},
				forced: true,
				charlotte: true,
				popup: false,
				filter(event, player) {
					if (event.skill != "qljuezhan") {
						return false;
					}
					for (var i of event.cards) {
						var type = get.type2(i, player);
						if (type == "equip" || type == "trick" || type == "basic" || type == "delay") {
							return true;
						}
					}
					return false;
				},
				content() {
					var map = {};
					for (var i of trigger.cards) {
						map[get.type2(i, player)] = true;
					}
					if (map.basic) {
						player.addTempSkill("qljuezhan_basic");
					}
					if (map.trick || map.delay) {
						player.draw(2);
					}
					if (map.equip) {
						trigger.baseDamage++;
						player.addTempSkill("qljuezhan_equip");
					}
				},
				sub: true,
				sourceSkill: "qljuezhan",
				_priority: 0,
			},
			basic: {
				enable: ["chooseToRespond"],
				filterCard(card, player) {
					return get.type(card) == "basic";
				},
				position: "hes",
				viewAs: {
					name: "sha",
				},
				sub: true,
				sourceSkill: "qljuezhan",
				_priority: 0,
				ai: {
					yingbian(card, player, targets, viewer) {
						if (get.attitude(viewer, player) <= 0) {
							return 0;
						}
						var base = 0,
							hit = false;
						if (get.cardtag(card, "yingbian_hit")) {
							hit = true;
							if (
								targets.some(target => {
									return target.mayHaveShan(viewer, "use") && get.attitude(viewer, target) < 0 && get.damageEffect(target, player, viewer, get.natureList(card)) > 0;
								})
							) {
								base += 5;
							}
						}
						if (get.cardtag(card, "yingbian_add")) {
							if (
								game.hasPlayer(function (current) {
									return !targets.includes(current) && lib.filter.targetEnabled2(card, player, current) && get.effect(current, card, player, player) > 0;
								})
							) {
								base += 5;
							}
						}
						if (get.cardtag(card, "yingbian_damage")) {
							if (
								targets.some(target => {
									return (
										get.attitude(player, target) < 0 &&
										(hit ||
											!target.mayHaveShan(viewer, "use") ||
											player.hasSkillTag(
												"directHit_ai",
												true,
												{
													target: target,
													card: card,
												},
												true
											)) &&
										!target.hasSkillTag("filterDamage", null, {
											player: player,
											card: card,
											jiu: true,
										})
									);
								})
							) {
								base += 5;
							}
						}
						return base;
					},
					canLink(player, target, card) {
						if (!target.isLinked() && !player.hasSkill("wutiesuolian_skill")) {
							return false;
						}
						if (player.hasSkill("jueqing") || player.hasSkill("gangzhi") || target.hasSkill("gangzhi")) {
							return false;
						}
						let obj = {};
						if (get.attitude(player, target) > 0 && get.attitude(target, player) > 0) {
							if (
								(player.hasSkill("jiu") ||
									player.hasSkillTag("damageBonus", true, {
										target: target,
										card: card,
									})) &&
								!target.hasSkillTag("filterDamage", null, {
									player: player,
									card: card,
									jiu: player.hasSkill("jiu"),
								})
							) {
								obj.num = 2;
							}
							if (target.hp > obj.num) {
								obj.odds = 1;
							}
						}
						if (!obj.odds) {
							obj.odds = 1 - target.mayHaveShan(player, "use", true, "odds");
						}
						return obj;
					},
					basic: {
						useful: [5, 3, 1],
						value: [5, 3, 1],
					},
					order(item, player) {
						let res = 3.2;
						if (player.hasSkillTag("presha", true, null, true)) {
							res = 10;
						}
						if (typeof item !== "object" || !game.hasNature(item, "linked") || game.countPlayer(cur => cur.isLinked()) < 2) {
							return res;
						}
						//let used = player.getCardUsable('sha') - 1.5, natures = ['thunder', 'fire', 'ice', 'kami'];
						let uv = player.getUseValue(item, true);
						if (uv <= 0) {
							return res;
						}
						let temp = player.getUseValue("sha", true) - uv;
						if (temp < 0) {
							return res + 0.15;
						}
						if (temp > 0) {
							return res - 0.15;
						}
						return res;
					},
					result: {
						target(player, target, card, isLink) {
							let eff = -1.5,
								odds = 1.35,
								num = 1;
							if (isLink) {
								eff = isLink.eff || -2;
								odds = isLink.odds || 0.65;
								num = isLink.num || 1;
								if (
									num > 1 &&
									target.hasSkillTag("filterDamage", null, {
										player: player,
										card: card,
										jiu: player.hasSkill("jiu"),
									})
								) {
									num = 1;
								}
								return odds * eff * num;
							}
							if (
								player.hasSkill("jiu") ||
								player.hasSkillTag("damageBonus", true, {
									target: target,
									card: card,
								})
							) {
								if (
									target.hasSkillTag("filterDamage", null, {
										player: player,
										card: card,
										jiu: player.hasSkill("jiu"),
									})
								) {
									eff = -0.5;
								} else {
									num = 2;
									if (get.attitude(player, target) > 0) {
										eff = -7;
									} else {
										eff = -4;
									}
								}
							}
							if (
								!player.hasSkillTag(
									"directHit_ai",
									true,
									{
										target: target,
										card: card,
									},
									true
								)
							) {
								odds -= 0.7 * target.mayHaveShan(player, "use", true, "odds");
							}
							_status.event.putTempCache("sha_result", "eff", {
								bool: target.hp > num && get.attitude(player, target) > 0,
								card: ai.getCacheKey(card, true),
								eff: eff,
								odds: odds,
							});
							return odds * eff;
						},
					},
					tag: {
						respond: 1,
						respondShan: 1,
						damage(card) {
							if (game.hasNature(card, "poison")) {
								return;
							}
							return 1;
						},
						natureDamage(card) {
							if (game.hasNature(card, "linked")) {
								return 1;
							}
						},
						fireDamage(card, nature) {
							if (game.hasNature(card, "fire")) {
								return 1;
							}
						},
						thunderDamage(card, nature) {
							if (game.hasNature(card, "thunder")) {
								return 1;
							}
						},
						poisonDamage(card, nature) {
							if (game.hasNature(card, "poison")) {
								return 1;
							}
						},
					},
				},
			},
			equip: {
				trigger: {
					player: "damageBegin2",
				},
				forced: true,
				filter(event, player) {
					var evt = event.getParent();
					return evt.skill == "qljuezhan" && evt.player == player;
					if (event.skill != "qljuezhan") {
						return false;
					}
					for (var i of event.cards) {
						var type = get.type2(i, player);
						if (type == "equip") {
							return true;
						}
					}
					return false;
				},
				content() {
					trigger.cancel();
				},
				sub: true,
				sourceSkill: "qljuezhan",
				_priority: 0,
			},
		},
		ai: {
			wuxie(target, card, player, viewer, status) {
				if (player === game.me && get.attitude(viewer, player._trueMe || player) > 0) {
					return 0;
				}
				if (status * get.attitude(viewer, target) * get.effect(target, card, player, target) >= 0) {
					return 0;
				}
			},
			basic: {
				order: 5,
				useful: 1,
				value: 5.5,
			},
			result: {
				player(player, target, card) {
					if (
						player.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: target,
								card: card,
							},
							true
						)
					) {
						return 0;
					}
					if (get.damageEffect(target, player, target) >= 0) {
						return 0;
					}
					let pd = get.damageEffect(player, target, player),
						att = get.attitude(player, target);
					if (att > 0 && get.damageEffect(target, player, player) > pd) {
						return 0;
					}
					let ts = target.mayHaveSha(player, "respond", null, "count"),
						ps = player.mayHaveSha(
							player,
							"respond",
							player.getCards("h", i => {
								return card === i || (card.cards && card.cards.includes(i)) || ui.selected.cards.includes(i);
							}),
							"count"
						);
					if (ts < 1 && ts * 8 < Math.pow(player.hp, 2)) {
						return 0;
					}
					if (att > 0) {
						if (ts < 1) {
							return 0;
						}
						return -2;
					}
					if (pd >= 0) {
						return pd / get.attitude(player, player);
					}
					if (ts - ps + Math.exp(0.8 - player.hp) < 1) {
						return -ts;
					}
					return -2 - ts;
				},
				target(player, target, card) {
					if (
						player.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: target,
								card: card,
							},
							true
						)
					) {
						return -2;
					}
					let td = get.damageEffect(target, player, target);
					if (td >= 0) {
						return td / get.attitude(target, target);
					}
					let pd = get.damageEffect(player, target, player),
						att = get.attitude(player, target);
					if (att > 0 && get.damageEffect(target, player, player) > pd) {
						return -2;
					}
					let ts = target.mayHaveSha(player, "respond", null, "count"),
						ps = player.mayHaveSha(
							player,
							"respond",
							player.getCards("h", i => {
								return card === i || (card.cards && card.cards.includes(i)) || ui.selected.cards.includes(i);
							}),
							"count"
						);
					if (ts < 1) {
						return -1.5;
					}
					if (att > 0) {
						return -2;
					}
					if (pd >= 0) {
						return -1;
					}
					if (ts - ps < 1) {
						return -2 - ts;
					}
					return -ts;
				},
			},
			tag: {
				respond: 2,
				respondSha: 2,
				damage: 1,
			},
		},
	},
	qlzhanyi: {
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object") {
					var evt = player.getLastUsed();
					if (evt && evt.card && get.cardNameLength(evt.card) != 0 && get.cardNameLength(card) != 0 && get.cardNameLength(evt.card) != get.cardNameLength(card)) {
						return num + 10;
					}
				}
			},
		},
		trigger: {
			player: "useCard",
		},
		frequent: true,
		audio: "xinzhanyi",
		getLastUsed(player, event) {
			var history = player.getAllHistory("useCard");
			var index;
			if (event) {
				index = history.indexOf(event) - 1;
			} else {
				index = history.length - 1;
			}
			if (index >= 0) {
				return history[index];
			}
			return false;
		},
		filter(event, player) {
			var evt = lib.skill.qlzhanyi.getLastUsed(player, event);
			var num = get.cardNameLength(event.card);
			if (!evt || !evt.card) {
				return false;
			}
			var num1 = get.cardNameLength(evt.card);
			player.addTip("qlzhanyi", "战意 " + get.cardNameLength(event.card), true);
			return num1 && num && num1 != "none" && num != "none" && num1 != num;
		},
		async content(event, trigger, player) {
			await player.draw();
		},
		_priority: 0,
	},
	qlguimian: {
		enable: "phaseUse",
		usable: 1,
		audio: "ext:五花米线/audio/skill:2",
		filter: function (event, player) {
			return player.countCards("he") > 0;
		},
		content: function () {
			"step 0";
			var result = player.chooseToDiscard("he", [1, 4]);
			("step 1");
			if (result.bool) {
				event.num = result.cards.length;
				var result1 = player.chooseControl("顺次", "逆次");
			}
			("step 2");
			if (result.control == "顺次") {
				if (event.num >= 1) {
					player.disableEquip(event.num);
				}
				if (event.num >= 2) {
					player.recover();
				}
				if (event.num >= 3) {
					player.draw(3);
				}
				if (event.num >= 4) {
					player.damage("fire");
				}
			} else {
				if (event.num >= 1) {
					player.damage("fire");
				}
				if (event.num >= 2) {
					player.draw(3);
				}
				if (event.num >= 3) {
					player.recover();
				}
				if (event.num >= 4) {
					player.disableEquip(event.num);
				}
			}
		},
		_priority: 0,
	},
	qljihuo: {
		trigger: {
			player: "loseAfter",
		},
		audio: "ext:五花米线/audio/skill:2",
		filter: function (event, player) {
			if (event.getParent().name == "useCard") return false;
			for (var i = 0; i < event.cards.length; i++) {
				if (get.type(event.cards[i]) == "equip" && get.position(event.cards[i]) == "d") return true;
			}
			return false;
		},
		content: function () {
			"step 0";
			player.draw(player.countDisabled() + 1);
			("step 1");
			var result = player.chooseTarget();
			("step 2");
			if (result.bool) {
				result.targets[0].link(true);
				var card = new lib.element.VCard({ name: "juedou" });
				if (player.canUse(card, result.targets[0])) {
					player.useCard(card, result.targets[0]);
				}
			}
		},
		_priority: 0,
	},
	qlgujie: {
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		audio: "ext:五花米线/audio/skill:2",
		frequent: true,
		filter(event, player) {
			if (player.countCards("h")) {
				return false;
			}
			const evt = event.getl(player);
			return evt && evt.player == player && evt.hs && evt.hs.length > 0;
		},
		locked: true,
		content: function () {
			"step 0";
			if (!player.hasDisabledSlot()) {
				event.goto(1);
			} else {
				player.chooseToEnable();
			}
			("step 1");
			player.link(true);
			("step 2");
			player.drawTo(player.getHandcardLimit());
			("step 3");
			player.addTempSkill("qlgujie_2");
			player.addMark("qlgujie_2", 1, false);
		},
		subSkill: {
			2: {
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("qlgujie_2");
					},
				},
				onremove: true,
				charlotte: true,
				marktext: "限",
				intro: {
					content: "手牌上限-#",
				},
				sub: true,
				sourceSkill: "qlgujie",
				_priority: 0,
			},
		},
		_priority: 0,
	},
	/*_hua_protect: {
		trigger: { player: ["changeSkillsBefore", "changeCharacterBefore"] },
		filter(event, player) {
			if (!lib.config["extension_五花米线_ql_guard"]) {
				return false;
			}
			if (player.group != "hua") {
				return false;
			}
			if (event.name == "changeSkillsBefore") {
				return event.removeSkill?.length;
			}
			return true;
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.name == "changeCharacter") {
				trigger.cancel();
			}
			else {
				trigger.removeSkill = [];
			}
		}
	},*/
};

export default skills;
