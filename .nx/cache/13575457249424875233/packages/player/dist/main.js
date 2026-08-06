import { Player as e, Stage as t, Vector2 as n, getFullPreviewSettings as r } from "@fantoche-dev/core";
//#endregion
//#region src/main.ts
var i = "<style>.initial{display:none}.state-initial .initial{display:block}.loading{display:none}.state-loading .loading{display:block}.ready{display:none}.state-ready .ready{display:block}.error{display:none}.state-error .error{display:block}:host{display:block;position:relative}.controls{background:linear-gradient(#0000 0%,#0000004d 100%);justify-content:space-between;align-items:center;height:10%;display:flex;position:absolute;bottom:0%;left:0;right:0}.timeline-container{z-index:5;width:calc(100% - 32px);height:100%;position:absolute;top:0%}.timeline{appearance:none;cursor:pointer;z-index:10;background:0 0/100% 40px no-repeat;width:100%;margin-left:16px;margin-right:16px;position:absolute;bottom:10px}.timeline::-webkit-slider-runnable-track{background:#fff;background:var(--webkit-track,white);width:100%;height:5px}.timeline:hover::-webkit-slider-runnable-track{background:#fff;background:var(--webkit-track,white);width:100%;height:5px}.timeline::-moz-range-track{background:#fff;background:var(--moz-track,white);width:100%;height:5px}.timeline::-ms-track{background:#fff;background:var(--ms-track,#c9c7c7);width:100%;height:4px}.timeline::-webkit-slider-thumb{appearance:none;cursor:pointer;opacity:0;background:#fff;border-radius:50%;width:16px;height:16px;margin-top:-6px;transition:opacity .2s}.timeline::-moz-range-thumb{appearance:none;cursor:pointer;opacity:0;background:#fff;border-radius:50%;width:16px;height:16px;margin-top:-6px;transition:opacity .2s}.timeline::-ms-thumb{appearance:none;cursor:pointer;opacity:0;background:#fff;border-radius:50%;width:16px;height:16px;margin-top:-6px;transition:opacity .2s}.timeline:hover::-webkit-slider-thumb{opacity:1;background:#fff}.timeline:hover::-moz-range-thumb{opacity:1;background:#fff}.timeline:hover::-ms-thumb{opacity:1;background:#fff}.overlay{opacity:0;z-index:0;justify-content:center;align-items:center;transition:opacity .1s;display:flex;position:absolute;inset:0}.overlay.state-ready:not(.auto){cursor:pointer}.overlay.playing:not(.hover):hover{cursor:none}.overlay.hover,.overlay.state-ready:focus-within,.overlay.state-ready:not(.playing){opacity:1}.overlay.state-loading,.overlay.state-error{opacity:1;transition:opacity 1s}.overlay.state-ready.auto{opacity:0}.button{width:16px;height:14px;cursor:inherit;background-color:#0000;background-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTEiIGhlaWdodD0iMTMiIHZpZXdCb3g9IjAgMCAxMSAxMyIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAgMS4wMDE0VjExLjM2MTRDMCAxMi4xNTE0IDAuODcgMTIuNjMxNCAxLjU0IDEyLjIwMTRMOS42OCA3LjAyMTRDMTAuMyA2LjYzMTQgMTAuMyA1LjczMTQgOS42OCA1LjMzMTRMMS41NCAwLjE2MTQwNUMwLjg3IC0wLjI2ODU5NiAwIDAuMjExNDA1IDAgMS4wMDE0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==);background-repeat:no-repeat;background-size:100% 100%;border:none;transition:scale .1s ease-in,opacity .1s;position:absolute;bottom:25px;left:14px}.playing .play-button{background-image:url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAxMiAxNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMEMxLjQ2OTU3IDAgMC45NjA4NTkgMC4yMTA3MTQgMC41ODU3ODYgMC41ODU3ODZDMC4yMTA3MTQgMC45NjA4NTkgMCAxLjQ2OTU3IDAgMlYxMkMwIDEyLjUzMDQgMC4yMTA3MTQgMTMuMDM5MSAwLjU4NTc4NiAxMy40MTQyQzAuOTYwODU5IDEzLjc4OTMgMS40Njk1NyAxNCAyIDE0QzIuNTMwNDMgMTQgMy4wMzkxNCAxMy43ODkzIDMuNDE0MjEgMTMuNDE0MkMzLjc4OTI5IDEzLjAzOTEgNCAxMi41MzA0IDQgMTJWMkM0IDEuNDY5NTcgMy43ODkyOSAwLjk2MDg1OSAzLjQxNDIxIDAuNTg1Nzg2QzMuMDM5MTQgMC4yMTA3MTQgMi41MzA0MyAwIDIgMFpNMTAgMEM5LjQ2OTU3IDAgOC45NjA4NiAwLjIxMDcxNCA4LjU4NTc5IDAuNTg1Nzg2QzguMjEwNzEgMC45NjA4NTkgOCAxLjQ2OTU3IDggMlYxMkM4IDEyLjUzMDQgOC4yMTA3MSAxMy4wMzkxIDguNTg1NzkgMTMuNDE0MkM4Ljk2MDg2IDEzLjc4OTMgOS40Njk1NyAxNCAxMCAxNEMxMC41MzA0IDE0IDExLjAzOTEgMTMuNzg5MyAxMS40MTQyIDEzLjQxNDJDMTEuNzg5MyAxMy4wMzkxIDEyIDEyLjUzMDQgMTIgMTJWMkMxMiAxLjQ2OTU3IDExLjc4OTMgMC45NjA4NTkgMTEuNDE0MiAwLjU4NTc4NkMxMS4wMzkxIDAuMjEwNzE0IDEwLjUzMDQgMCAxMCAwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==)}.auto .play-button{display:none}.current-time{color:#fff;font-family:Arial,sans-serif;font-size:14px;line-height:14px;position:absolute;bottom:25px;left:44px}.canvas{opacity:0;width:100%;transition:opacity .1s;display:block}.canvas.state-ready{opacity:1}.message{text-align:center;color:#fff9;background-color:#000000de;border-radius:4px;margin:16px;padding:8px 16px;font-family:JetBrains Mono,sans-serif;font-size:20px}.loader{width:50%;max-width:96px;animation:2s cubic-bezier(.5,0,.5,1) infinite stroke,2s linear infinite rotate;display:none;rotate:-90deg}@keyframes stroke{0%{stroke-dasharray:5.65487 50.8938;stroke-dashoffset:2.82743px}50%{stroke-dasharray:50.8938 5.65487;stroke-dashoffset:-2.82743px}to{stroke-dasharray:5.65487 50.8938;stroke-dashoffset:-53.7212px}}@keyframes rotate{0%{rotate:-110deg}to{rotate:250deg}}</style><div class=\"overlay\" part=\"overlay\">\n  <div class=\"controls\">\n    <button\n      part=\"play-button\"\n      title=\"Play / Pause\"\n      class=\"button play-button ready\"\n      tabindex=\"0\"\n    ></button>\n    <!-- New button to the right -->\n    <span class=\"current-time\" part=\"current-time\">0:00 / 0:00</span>\n    <div class=\"timeline-container\">\n      <input\n        type=\"range\"\n        class=\"timeline\"\n        value=\"0\"\n        min=\"0\"\n        max=\"100\"\n        step=\"1\"\n      />\n    </div>\n  </div>\n  <div part=\"message\" class=\"message error\">\n    An error occurred while loading the animation.\n  </div>\n  <svg\n    part=\"loader\"\n    class=\"loader loading\"\n    viewBox=\"0 0 24 24\"\n    stroke=\"#ffffff\"\n    stroke-width=\"2\"\n    fill=\"transparent\"\n  ></svg>\n</div>\n", a = "revideo-player", o = class extends HTMLElement {
	static get observedAttributes() {
		return [
			"src",
			"quality",
			"width",
			"height",
			"auto",
			"variables"
		];
	}
	get auto() {
		return !!this.getAttribute("auto");
	}
	get hover() {
		return this.getAttribute("auto") === "hover";
	}
	get quality() {
		let e = this.getAttribute("quality");
		return e ? parseFloat(e) : this.defaultSettings.resolutionScale;
	}
	get width() {
		let e = this.getAttribute("width");
		return e ? parseFloat(e) : this.defaultSettings.size.width;
	}
	get height() {
		let e = this.getAttribute("height");
		return e ? parseFloat(e) : this.defaultSettings.size.height;
	}
	get variables() {
		try {
			let e = this.getAttribute("variables");
			return e ? JSON.parse(e) : {};
		} catch {
			return this.project.logger.warn("Project variables could not be parsed."), {};
		}
	}
	root;
	canvas;
	overlay;
	button;
	state = "initial";
	project = null;
	player = null;
	defaultSettings;
	abortController = null;
	mouseMoveId = null;
	finished = !1;
	playing = !1;
	connected = !1;
	stage = new t();
	timeline;
	constructor() {
		super(), this.root = this.attachShadow({ mode: "open" }), this.root.innerHTML = i, this.overlay = this.root.querySelector(".overlay"), this.button = this.root.querySelector(".button"), this.canvas = this.stage.finalBuffer, this.canvas.classList.add("canvas"), this.root.prepend(this.canvas), this.timeline = this.root.querySelector(".timeline"), this.timeline.addEventListener("input", this.handleTimelineChange), this.timeline.addEventListener("change", this.handleTimelineChange), this.button.addEventListener("click", this.handleClick), this.button.addEventListener("mousedown", this.handleMouseDown), this.overlay.addEventListener("click", this.handleClick), this.overlay.addEventListener("mousemove", this.handleMouseMove), this.overlay.addEventListener("mouseleave", this.handleMouseLeave), this.overlay.addEventListener("mousedown", this.handleMouseDown), this.setState("initial");
	}
	handleTimelineChange = (e) => {
		let t = e.target, n = parseFloat(t.value);
		this.player?.playback.duration && this.player?.requestSeek(n);
	};
	handleMouseMove = () => {
		this.mouseMoveId && clearTimeout(this.mouseMoveId), this.hover && !this.playing && this.setPlaying(!0), this.mouseMoveId = window.setTimeout(() => {
			this.mouseMoveId = null, this.updateClass();
		}, 2e3), this.updateClass();
	};
	handleMouseLeave = () => {
		this.hover && this.setPlaying(!1), this.mouseMoveId && (clearTimeout(this.mouseMoveId), this.mouseMoveId = null, this.updateClass());
	};
	handleMouseDown = (e) => {
		e.target.closest(".timeline") || e.preventDefault();
	};
	handleClick = (e) => {
		e.target.closest(".timeline") || this.auto || (this.handleMouseMove(), this.setPlaying(!this.playing), this.button.animate([{ scale: "0.9" }, {
			scale: "1",
			easing: "ease-out"
		}], { duration: 200 }));
	};
	setState(e) {
		this.state = e, this.setPlaying(this.playing);
	}
	setPlaying(e) {
		this.state === "ready" && (e || this.auto && !this.hover) ? (this.player?.togglePlayback(!0), this.playing = !0) : (this.player?.togglePlayback(!1), this.playing = !1), this.updateClass();
	}
	updateClass() {
		this.overlay.className = `overlay state-${this.state}`, this.canvas.className = `canvas state-${this.state}`, this.overlay.classList.toggle("playing", this.playing), this.overlay.classList.toggle("auto", this.auto), this.overlay.classList.toggle("hover", this.mouseMoveId !== null), this.connected && (this.mouseMoveId !== null || !this.playing ? this.dataset.overlay = "" : delete this.dataset.overlay);
	}
	async updateSource(t) {
		this.setState("initial"), this.abortController?.abort(), this.abortController = new AbortController();
		let n;
		try {
			let e = import(
				/* webpackIgnore: true */
				/* @vite-ignore */
				t
), r = new Promise((e) => setTimeout(e, 200));
			await Promise.any([r, e]), this.setState("loading"), n = (await e).default;
		} catch (e) {
			console.error(e), this.setState("error");
			return;
		}
		this.defaultSettings = r(n);
		let i = new e(n);
		i.setVariables(this.variables), this.finished = !1, this.player?.onRender.unsubscribe(this.render), this.player?.togglePlayback(!1), this.player?.deactivate(), this.project = n, this.player = i, this.updateSettings(), this.player.onRender.subscribe(this.render), this.player.togglePlayback(this.playing), this.setState("ready");
	}
	attributeChangedCallback(e, t, n) {
		switch (e) {
			case "auto":
				this.setPlaying(this.playing);
				break;
			case "src":
				this.updateSource(n);
				break;
			case "quality":
			case "width":
			case "height":
				this.updateSettings();
				break;
			case "variables": this.player?.setVariables(this.variables), this.player?.requestSeek(this.player.playback.frame);
		}
	}
	disconnectedCallback() {
		this.connected = !1, this.player?.deactivate(), this.player?.onRender.unsubscribe(this.render);
	}
	connectedCallback() {
		this.connected = !0, this.player?.activate(), this.player?.onRender.subscribe(this.render);
	}
	render = async () => {
		if (this.player) {
			await this.stage.render(this.player.playback.currentScene, this.player.playback.previousScene), this.timeline.setAttribute("min", "0"), this.timeline.setAttribute("step", "1"), this.timeline.setAttribute("max", this.player?.playback.duration.toString());
			let e = this.player.status.time, t = this.player.status.framesToSeconds(this.player.playback.duration);
			if (t) {
				let n = this.player.status.secondsToFrames(e);
				this.timeline.value = n.toString();
				let r = `linear-gradient(to right, rgb(180, 180, 180) 0%, rgb(180, 180, 180) ${100 * n / this.player.status.secondsToFrames(t)}%, white ${100 * n / this.player.status.secondsToFrames(t)}%, white 100%)`;
				this.timeline.style.background = r, this.timeline.style.setProperty("--webkit-track", r), this.timeline.style.setProperty("--moz-track", r), this.timeline.style.setProperty("--ms-track", r);
				let i = this.formatTime(e), a = this.formatTime(t), o = this.root.querySelector(".current-time");
				o && (o.textContent = `${i} / ${a}`);
			}
		}
	};
	updateSettings() {
		let e = {
			...this.defaultSettings,
			size: new n(this.width, this.height),
			resolutionScale: this.quality
		};
		this.stage.configure(e), this.player.configure(e);
	}
	formatTime(e) {
		let t = Math.floor(e / 60), n = Math.floor(e % 60);
		return `${t.toString().padStart(2, "0")}:${n.toString().padStart(2, "0")}`;
	}
};
customElements.get(a) || customElements.define(a, o);
//#endregion
