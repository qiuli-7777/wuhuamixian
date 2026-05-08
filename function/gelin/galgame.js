export function initGalgame(lib, game, ui, get, ai, _status, datasrc) {
	galgame.backgroundMusic = document.createElement("audio");
	galgame.audio = document.createElement("audio");
	galgame.sce = function(shijian) {
		var next = game.createEvent('sce', false);
		next.shijian = shijian;
		game.broadcast(function(name) {
			galgame.sces({
				shijian: name,
				pause: false
			});
		}, shijian);
		next.setContent(galgame.sces);
		next.func = {};
		for (var i in galgame.func) {
			next.func[i] = galgame.func[i];
		}
		return next;
	}
	galgame.cg = function(src, callback, bool, background) {
		var cg = document.createElement("video");
		cg.setAttribute("width", "100%");
		cg.setAttribute("height", "100%");
		cg.setAttribute("src", src);
		cg.setAttribute("autoplay", "autoplay");
		if (callback) cg.addEventListener("ended", callback);
		cg.addEventListener("canplaythrough", function() {
			if (background) background.appendChild(cg);
			if (bool !== false) {
				this.onclick = function() {
					this.play();
					this.currentTime = this.duration;
				}
			}
		});
		cg.onerror = function() {
			console.log('视频加载失败，请检查地址是否异常。');
			if (cg.onended) cg.onended();
		}
		return cg;
	};
	galgame.video = function(src, event) {
		if (typeof src == 'function') src = src(event);
		galgame.backgroundMusic.pause();
		ui.backgroundMusic.pause();
		var di = ui.create.div('.cg');
		var cg = galgame.cg(lib.assetURL + "extension/" + src, function() {
			event.beijing.removeChild(di);
			if (galgame.backgroundMusic && galgame.backgroundMusic.duration) {
				galgame.backgroundMusic.play();
			} else if (ui.backgroundMusic && ui.backgroundMusic.duration) {
				ui.backgroundMusic.play();
			}
			galgame.end(event);
		});
		di.appendChild(cg);
		event.beijing.appendChild(di);
	};
	galgame.choose = function(list, event) {
		var choose = ui.create.div('.choose', event.beijing);
		for (var i in list) {
			var sele = ui.create.div('.sele', choose);
			sele.onclick = function() {
				event.chooses.push(this.link);
				choose.remove();
				galgame.end(event);
			};
			if (event.color) sele.style.backgroundColor = event.color;
			sele.innerHTML = list[i];
			sele.link = i;
		}
	};
	galgame.list = ['audio', 'background', 'music'];
	galgame.adapt = function(list, event) {
		var result = [];
		var obj = {};
		for (var node of list) {
			if (typeof node == 'string') {
				var link = node.split(':');
				if (galgame.list.includes(link[0])) {
					obj[link[0]] = link[1];
				} else if (link[0] == 'cg') {
					obj.cg = link[1];
					result.push(obj);
					obj = {};
				} else if (link[0] == 'function') {
					if (!obj.contents) obj.contents = [];
					obj.contents.push(event.func[link[1]]);
				} else if (link[0] == 'booth') {
					if (!obj.booth) obj.booth = {};
					if (link[1] == 'none') {
						obj.booth[link[2] || 'node'] = false;
					} else {
						obj.booth[link[6] || 'node'] = link.slice(1);
					}
				} else if (link[0] == 'choose') {
					result[result.length - 1].choose = {};
					for (var i = 1; i < link.length; i++) {
						result[result.length - 1].choose[link[i]] = link[i];
					}
				} else if (link[0] == 'color') {
					obj.color = link[1];
				} else if (link[0] == 'title') {
					obj.name = link[1];
					obj.name2 = link[2];
				} else if (link[0] == 'sp') {
					obj.avatar = link[3];
					obj.name = link[2];
					obj.text = link[1];
					result.push(obj);
					obj = {};
				} else if (link[0] == 'none') {
					obj.avatar = false;
					obj.avatar2 = false;
					obj.text = link[1];
					result.push(obj);
					obj = {};
				} else if (link[0] == 'right') {
					if (link[1] == 'none') {
						obj.avatar2 = false;
					} else if (!link[3] || link[3] == 'left') {
						obj.avatar2 = link[1];
						obj.name2 = link[2];
						if (!obj.contents) obj.contents = [];
						obj.contents.push(function(event) {
							event.avater0.classList.add("darksome");
							event.title0.hide();
						})
					}
				} else if (link[0] == 'switch') {
					result.push(galgame.text[link[1]]);
				} else {
					if (link[2] == 'right') {
						link[3] = 'right';
						link[2] = undefined;
					}
					if (link[3] == 'right') {
						obj.avatar2 = link[0];
						obj.name2 = link[2];
						result.push(obj);
					} else {
						obj.avatar = link[0];
						obj.name = link[2];
						result.push(obj);
					}
					obj.text = link[1];
					obj = {};
				}
			} else {
				result.push(node);
			}
		}
		return result;
	};
	galgame.sces = function(event) {
		if (!event.obj) {
			if (galgame.text[event.shijian]) {
				event.obj = galgame.adapt(galgame.text[event.shijian], event);
			} else if (Array.isArray(event.shijian)) {
				event.obj = galgame.adapt(event.shijian, event);
			} else {
				return;
			}
			if (ui.backgroundMusic) ui.backgroundMusic.pause();
			event.chooses = [];
			event.beijing = ui.create.div('.scedi', ui.window);
			event.booth = {};
			event.node = ui.create.div('.sce', event.beijing);
			event.drive = ui.create.div('.drive', event.beijing);
			event.avater0 = ui.create.div('.tou.left', event.node);
			event.txt = ui.create.div('.txt', event.node);
			event.avater1 = ui.create.div('.tou.right', event.node);
			var title = ui.create.div('.title', event.node);
			event.title0 = ui.create.div('.left.hidden', title);
			event.title1 = ui.create.div('.right.hidden', title);
			event.num = 0;
			event.fast = ui.create.div('.fast', event.beijing);
			event.fast.innerHTML = '▷▷';
			event.fast.onclick = function() {
				if (this.link) {
					clearInterval(this.link);
					delete this.link;
					this.innerHTML = '▷▷';
				} else {
					this.link = setInterval(function() {
						if (num == event.obj.length) clearInterval(event.fast.link);
						if (event.drive.onclick) event.drive.onclick();
					}, 100);
					this.innerHTML = '▶▶';
				}
			}
			for (var init of galgame.inits) {
				init(event);
			}
			if (galgame.backgroundMusic.paused) galgame.backgroundMusic.src = '';
		}
		if (event.pause !== false) game.pause();
		var num = event.num;
		var obj = event.obj[num];
		if (Array.isArray(obj)) {
			var bool, num = 0;
			while (typeof bool != 'boolean') {
				if (typeof obj[0] == 'function') {
					bool = obj[0](event);
				} else {
					bool = true;
					num = -1;
				}
				if (galgame.text[bool]) obj = galgame.text[bool];
			}
			if (bool) {
				obj = galgame.adapt(obj, event);
				obj.parent = {
					obj: event.obj,
					num: event.num,
				}
				event.obj = obj;
				event.num = num;
			}
			galgame.end(event);
			return;
		}
		if (obj.color) {
			var color = obj.color;
			if (typeof color == 'function') color = color(event);
			if (color) {
				event.node.style.backgroundColor = color;
				event.color = color;
			}
		}
		if (obj.background) {
			var background = obj.background;
			if (typeof background == 'function') background = background(event);
			if (background === false) {
				event.beijing.style.backgroundImage = "";
			} else if (background) {
				event.beijing.setBackgroundImage('extension/' + background);
			}
		}
		if (obj.audio) {
			var audio = obj.audio;
			if (typeof audio == 'function') audio = audio(event);
			galgame.audio.src = lib.assetURL + "extension/" + audio;
		}
		if (obj.music) {
			var music = obj.music;
			if (typeof music == 'function') music = music(event);
			if (music === false) {
				galgame.backgroundMusic.pause();
				galgame.backgroundMusic.src = '';
			} else if (music) {
				galgame.backgroundMusic.src = lib.assetURL + "extension/" + music;
			}
		}
		for (var i in obj.booth) {
			if (!event.booth[i]) event.booth[i] = ui.create.div(".scetu", event.beijing);
			if (typeof obj.booth[i] == 'function') {
				event.booth[i].show();
				obj.booth[i](event.booth[i]);
			} else if (typeof obj.booth[i] == 'object') {
				event.booth[i].show();
				var list = obj.booth[i];
				event.booth[i].setBackgroundImage('extension/' + list[0]);
				event.booth[i].style.width = list[1];
				event.booth[i].style.height = list[2];
				event.booth[i].style.left = list[3];
				event.booth[i].style.top = list[4];
			} else {
				event.booth[i].hide();
			}
		}
		var avatars = [obj.avatar, obj.avatar2];
		for (var i = 0; i < 2; i++) {
			if (typeof avatars[i] == 'function') avatars[i] = avatars[i](event);
			var avatar = avatars[i];
			if (avatar === false) {
				event['avater' + i].hide();
			} else {
				if (avatar) {
					event['avater' + i].show();
					event['avater' + i].classList.remove("darksome");
					if (lib.character[avatar]) {
						event['avater' + i].setBackground(avatar, "character");
					} else {
						event['avater' + i].setBackgroundImage('extension/' + avatar);
					}
				} else {
					event['avater' + i].classList.add("darksome");
				}
			}
		}
		var names = [obj.name || lib.translate[avatars[0]] || '', obj.name2 || lib.translate[avatars[1]] || ''];
		for (var i = 0; i < 2; i++) {
			var name = names[i];
			if (typeof name == 'function') name = name(event);
			if (name.length) {
				event['title' + i].show();
				event['title' + i].innerHTML = name;
			} else {
				event['title' + i].hide();
			}
		}
		if (obj.cg) {
			galgame.video(obj.cg, event);
			return;
		}
		var count = 0;
		var text = obj.text;
		if (typeof text == 'function') text = text(event);
		var link = text.replace(/@/g, lib.config.connect_nickname);
		var show = function() {
			if (link[count] == "<") {
				for (var j = count; j < link.length; j++) {
					if (link[j] == ">") {
						if (link[j + 1] && link[j + 1] == "<") {
							continue;
						}
						count = j + 1;
						break;
					}
				}
			}
			var str = link.substr(0, count);
			event.txt.innerHTML = str;
			count++;
			if (count <= link.length) {
				setTimeout(show, 70);
			} else {
				if (obj.choose) {
					galgame.choose(obj.choose, event);
				} else {
					event.drive.onclick = function() {
						if (!_status.pausing && !_status.dragged && !_status.clicked && !lib.config.test_game) {
							ui.system.show();
							ui.time.show();
							ui.historybar.classList.remove("paused");
							ui.arena.classList.remove("paused");
							ui.window.classList.remove("touchinfohidden");
							game.resume2();
							if (game.onresume) {
								game.onresume();
							}
						}
						this.onclick = false;
						galgame.end(event);
					}
				}
			}
		}
		show();
		event.drive.onclick = function() {
			count = link.length;
		};
		if (obj.content) obj.content(event);
		if (obj.contents) {
			for (var func of obj.contents) {
				func(event);
			}
		}
	};
	galgame.end = function(event) {
		event.num++;
		galgame.audio.pause();
		galgame.audio.src = '';
		if (event.num < event.obj.length) {
			if (event.pause === false) {
				galgame.sces(event);
			} else {
				event.redo();
				game.resume();
			}
		} else if (event.obj.parent) {
			var parent = event.obj.parent;
			event.obj = parent.obj;
			event.num = parent.num;
			galgame.end(event);
		} else {
			if (ui.backgroundMusic && ui.backgroundMusic.duration) ui.backgroundMusic.play();
			event.result = {
				bool: event.chooses[0],
				chooses: event.chooses.slice(0),
			}
			galgame.backgroundMusic.pause();
			ui.window.removeChild(event.beijing);
			if (event.pause !== false) game.resume();
		}
	};
	galgame.backgroundMusic.addEventListener("ended", function() {
		galgame.backgroundMusic.currentTime = 0;
		if (galgame.backgroundMusic && galgame.backgroundMusic.duration) galgame.backgroundMusic.play();
	});
	galgame.backgroundMusic.oncanplay = function() {
		galgame.backgroundMusic.play();
	};
	galgame.audio.oncanplay = function() {
		galgame.audio.play();
	};
	lib.init.css(lib.assetURL + 'extension/' + datasrc + '/gelin', 'galgame');
}
