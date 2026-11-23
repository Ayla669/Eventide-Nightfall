
const state = require("menu/state");

const T = {
    bgStart: 2.0,
    bgFull: 7.6,
    logoIn: 7.75,
    logoInLen: 1.5,
    glideStart: 14.4,
    drop: 15.93,
    reveal: 1.1,
    flash: 0.55,
    flashAmount: 0.28
};

// Textos mostrados abaixo da logo (edite aqui)
const TEXT = {
    subtitle: "This Planet is Mine...",
    author: "by Aira",
    version: "v0.4"
};

// Tempos do texto (segundos da musica)
const TX = {
    subIn: 9.2,        // subtitulo comeca a surgir
    subInLen: 1.8,
    infoIn: 10.6,      // autor + versao
    infoInLen: 1.6,
    outStart: 13.0,    // texto some antes da logo subir
    outEnd: 14.3
};

const GRACE_MS = 4000;
const SKIP_FADE = 0.35;
const ZOOM = 0.10;
const LOGO_CENTER_SCALE = 1.35;

function clamp01(x){
    return x < 0 ? 0 : (x > 1 ? 1 : x);
}

function lerp(a, b, t){
    return a + (b - a) * t;
}

function startIntro(){
    const Reflect = Packages.arc.util.Reflect;
    const startWall = Time.millis();

    let finished = false;
    let skipWall = -1;
    let unblocked = false;

    // relogio suave: anda pelo tempo real e so e "puxado" devagar para a
    // posicao da musica (que atualiza em degraus por causa do buffer de audio)
    let smoothT = -1;
    let lastWall = startWall;
    let noMusic = false;

    try{
        noMusic = Core.settings.getInt("musicvol", 100) <= 0;
    }catch(e){}

    function musicPos(){
        try{
            const m = Musics.menu;
            if(m != null && m.isPlaying()) return m.getPosition();
        }catch(e){}
        try{
            const cur = Reflect.get(Vars.control.sound, "current");
            if(cur != null && cur.isPlaying()) return cur.getPosition();
        }catch(e){}
        return -1;
    }

    function clock(){
        const nowWall = Time.millis();
        const dt = Math.min((nowWall - lastWall) / 1000, 0.5);
        lastWall = nowWall;

        const p = noMusic ? -1 : musicPos();

        if(smoothT < 0){
            if(p >= 0){
                smoothT = p;
            }else if(noMusic){
                smoothT = 0;
            }else if(nowWall - startWall > GRACE_MS){
                noMusic = true;   // a musica nao veio: segue sem ela
                smoothT = 0;
            }else{
                return -1;        // esperando a musica comecar
            }
            return smoothT;
        }

        smoothT += dt;

        if(p >= 0){
            const err = p - smoothT;
            if(Math.abs(err) > 0.5){
                smoothT = p;      // desalinhou muito: ressincroniza
            }else{
                const maxStep = dt * 0.15;   // corrige no maximo 15% da velocidade
                smoothT += Math.max(-maxStep, Math.min(maxStep, err));
            }
        }

        return smoothT;
    }

    const Fonts = Packages.mindustry.ui.Fonts;
    const Align = Packages.arc.util.Align;
    const Tmp = Packages.arc.util.Tmp;
    const Color = Packages.arc.graphics.Color;

    function drawText(str, x, y, k, r, g, b, a){
        if(a <= 0.003) return;
        const font = Fonts.outline;
        const data = font.getData();
        const old = data.scaleX;
        try{
            font.setColor(Tmp.c1.set(r, g, b, a));
            data.setScale(old * k);
            font.draw(str, x, y, Align.center);
        }finally{
            data.setScale(old);
            font.setColor(Color.white);
        }
    }

    function skipPressed(){
        try{
            return Core.input.justTouched()
                || Core.input.keyTap(KeyCode.escape)
                || Core.input.keyTap(KeyCode.space)
                || Core.input.keyTap(KeyCode.enter);
        }catch(e){
            return false;
        }
    }

    function getBackground(){
        let region = state.background;
        if(region == null){
            region = Core.atlas.find(Vars.mobile
                ? "eventide-ev-background-mobile-1"
                : "eventide-ev-background-pc-1");
        }
        return region;
    }

    const overlay = extend(Element, {
        draw: function(){
            if(finished) return;
            try{
                render();
            }catch(e){
                print("Eventide: erro na intro: " + e);
                finish();
            }
        }
    });

    function finish(){
        if(finished) return;
        finished = true;
        try{
            Draw.reset();
            overlay.remove();
        }catch(e){}
        state.finish();
    }

    function render(){
        const sw = Core.graphics.getWidth();
        const sh = Core.graphics.getHeight();

        if(overlay.width != sw || overlay.height != sh){
            overlay.setBounds(0, 0, sw, sh);
        }

        const nowWall = Time.millis();
        let t = clock();

        if(skipWall < 0 && (t < T.drop) && skipPressed()){
            skipWall = nowWall;
        }

        const skipping = skipWall >= 0;
        if(skipping || t > T.drop){
            if(!unblocked){
                unblocked = true;
                overlay.touchable = Touchable.disabled;
            }
        }

        let cover;
        let bgA, zoom, logoA, g, flash;

        if(skipping){
            const k = clamp01((nowWall - skipWall) / 1000 / SKIP_FADE);
            cover = 1 - k;
            bgA = 1; zoom = 1; logoA = 1; g = 1; flash = 0;
            t = T.drop;
        }else{
            if(t < 0){
                cover = 1; bgA = 0; zoom = 1 + ZOOM; logoA = 0; g = 0; flash = 0;
            }else{
                const zp = clamp01((t - T.bgStart) / (T.drop - T.bgStart));
                zoom = 1 + ZOOM * (1 - Interp.pow2Out.apply(zp));

                bgA = Interp.smoother.apply(clamp01((t - T.bgStart) / (T.bgFull - T.bgStart)));

                logoA = Interp.pow3Out.apply(clamp01((t - T.logoIn) / T.logoInLen));

                g = Interp.smoother.apply(clamp01((t - T.glideStart) / (T.drop - T.glideStart)));

                flash = t > T.drop
                    ? T.flashAmount * Math.max(0, 1 - (t - T.drop) / T.flash)
                    : 0;

                cover = t > T.drop
                    ? 1 - Interp.smoother.apply(clamp01((t - T.drop) / T.reveal))
                    : 1;
            }
        }

        if(cover <= 0.001){
            finish();
            return;
        }

        if(bgA < 1){
            Draw.color(0, 0, 0, 1);
            Fill.crect(0, 0, sw, sh);
        }

        const bg = getBackground();
        if(bg != null && bgA > 0){
            const imageAspect = bg.width / bg.height;
            const screenAspect = sw / sh;
            let dw, dh;
            if(imageAspect > screenAspect){
                dh = sh;
                dw = sh * imageAspect;
            }else{
                dw = sw;
                dh = sw / imageAspect;
            }
            Draw.color(1, 1, 1, bgA * cover);
            Draw.rect(bg, sw / 2, sh / 2, dw * zoom, dh * zoom);
        }

        const logo = Core.atlas.find("logo");
        if(logo != null && logoA > 0.001){
            let marginTop = 0;
            try{
                marginTop = Core.scene.marginTop || 0;
            }catch(e){}
            const usableH = sh - marginTop;

            const ratio = logo.height / logo.width;
            const finalW = Math.min(logo.width * Scl.scl(1), sw - Scl.scl(20));
            const finalH = finalW * ratio;
            const finalX = Math.floor(sw / 2);
            const finalY = Math.floor(usableH - 6 - finalH) + finalH / 2
                - (Core.graphics.isPortrait() ? Scl.scl(30) : 0);

            const centerW = Math.min(finalW * LOGO_CENTER_SCALE, sw * 0.86);
            const enterScale = 0.88 + 0.12 * logoA;

            const lw = lerp(centerW * enterScale, finalW, g);
            const lh = lw * ratio;
            const lx = lerp(sw / 2, finalX, g);
            const ly = lerp(usableH / 2, finalY, g);

            Draw.color(1, 1, 1, logoA * cover);
            Draw.rect(logo, lx, ly, lw, lh);

            // ---- nome / subtitulo / autor, abaixo da logo (so antes da subida) ----
            if(!skipping){
                const out = 1 - Interp.smoother.apply(clamp01((t - TX.outStart) / (TX.outEnd - TX.outStart)));
                const subA = Interp.pow2Out.apply(clamp01((t - TX.subIn) / TX.subInLen)) * out;
                const infoA = Interp.pow2Out.apply(clamp01((t - TX.infoIn) / TX.infoInLen)) * out;

                if(out > 0.003){
                    const baseY = ly - lh / 2 - Scl.scl(10);
                    // sobe um pouquinho enquanto aparece (gradual)
                    const subY = baseY - Scl.scl(10) * (1 - subA);
                    const infoY = baseY - Scl.scl(34) - Scl.scl(8) * (1 - infoA);

                    drawText(TEXT.subtitle, lx, subY, 1.25, 0.13, 1, 0.77, subA);
                    drawText(TEXT.author + "  -  " + TEXT.version, lx, infoY, 0.85, 0.85, 0.9, 1, infoA * 0.85);
                }
            }
        }

        if(flash > 0.001){
            Draw.color(1, 1, 1, flash);
            Fill.crect(0, 0, sw, sh);
        }

        Draw.reset();
    }

    overlay.setBounds(0, 0, Core.graphics.getWidth(), Core.graphics.getHeight());
    Core.scene.add(overlay);
    overlay.toFront();

    print("Eventide: intro iniciada" + (noMusic ? " (sem musica)" : "") + ".");
}

Events.on(ClientLoadEvent, () => {
    if(!state.active) return;
    try{
        startIntro();
    }catch(e){
        print("Eventide: nao foi possivel iniciar a intro: " + e);
        state.finish();
    }
});
