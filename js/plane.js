(function(canvas, GAME, images) {
    'use strict';

    var config, state, utile, factory, controler, model, viewer;

    GAME.config = config = {
        CANVAS: canvas,
        CONTEXT: canvas.getContext('2d'),
        LEVEL: document.getElementById('level'),
        SCORE: document.getElementById('score'),
        LIFE: document.getElementById('life'),
        ENERGY: document.getElementById('energy'),
        HIT: document.getElementById('hit'),
        WIDTH: canvas.width,
        HEIGHT: canvas.height,
        TOTALLIFE: 3,
        BGSTEP: 1,
        TIME: 5000,
        SPACE: 32,
        KILLALLJET: 13,
        NOTPRESS: -1,
        ENEMYRATE: 1000, // 开始每秒1个
        DECLINE: 1.25, //加快产生敌机的速率
        UPDATE: 500, //1000升级
        STATES: {
            NOTREADY: -1,
            START: 0,
            LOADING: 1,
            RUNNING: 2,
            PAUSED: 3,
            GAMEOVER: 4
        },
        IMGS: {}
    };

    GAME.state = state = {
        level: 0,
        score: 0,
        interval: 40,
        keyCode: config.NOTPRESS,
        period: config.STATES.NOTREADY,
        nextLevel: config.UPDATE
    };

    GAME.utile = utile = {
        random: function(min, max) {
            return Math.floor(Math.random() * (max - min + 1) + min);
        },
        removeGone: function(coll) {
            var curPos = -1,
                item = null,
                index = coll.length - 1;

            for (; index >= 0; index--) {
                item = coll[index];

                if (item.destory) {
                    curPos = coll.indexOf(item);

                    if (curPos !== -1) {
                        coll.splice(curPos, 1);
                        curPos = -1;
                    }
                }
            }
        },
        isTimeout: function(rate, last) {
            return (Date.now() - last) >= rate;
        },
        setStateByCode: function(watchState, stateToSet) {
            if (state.keyCode === watchState) {
                state.period = stateToSet;
                state.keyCode = config.NOTPRESS;
            }
        },
        extend: function(target, obj) {
            var key;

            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    target[key] = obj[key];
                }
            }
        },
        refreshInfo: function(jet) {
            if (state.score > state.nextLevel) {
                state.level++;

                jet.life++;
                jet.energy++;

                config.ENEMYRATE /= config.DECLINE;
                factory.EnemyJet.prototype.lifeMap.forEach(function(life, index, coll) {
                    coll[index] = Math.ceil(life * config.DECLINE);
                });

                config.UPDATE *= 2;
                state.nextLevel += config.UPDATE;
            }

            config.SCORE.innerHTML = state.score;
            config.LEVEL.innerHTML = state.level;

            config.LIFE.innerHTML = jet.life;
            config.ENERGY.innerHTML = jet.energy;
            config.HIT.innerHTML = jet.hit;
        }
    };

    // load all images into config.IMGS and setting canvas
    (function() {
        var key = '',
            i = 0,
            notComplete = 0;

        function onload() {
            --notComplete <= 0 &&
                (state.period = config.STATES.START);
        }

        function makeImage(path) {
            var newImg = new Image();

            ++notComplete;
            newImg.src = path;
            newImg.onload = onload;

            return newImg;
        }

        for (key in images) {
            if (images.hasOwnProperty(key)) {
                if (Array.isArray(images[key])) {
                    config.IMGS[key] = [];

                    for (i = 0; i < images[key].length; i++) {
                        config.IMGS[key].push(makeImage(images[key][i]));
                    }
                } else {
                    config.IMGS[key] = makeImage(images[key]);
                }
            }
        }

        // setting up width and height
        config.CANVAS.width = Math.min(window.innerWidth, 480);
        config.CANVAS.height = Math.min(window.innerHeight, 650);
        config.SCALEX = config.CANVAS.width / 480;
        config.SCALEY = config.CANVAS.height / 650;
    }());

    GAME.factory = factory = {};
    (function() {
        // Sharp constructor function
        factory.Sharp = function(setting) {
            this.image = setting.image;
            this.x = setting.x || 0;
            this.y = setting.y || 0;
        };

        factory.Sharp.prototype = {
            constructor: factory.Sharp,
            changeImage: function(image) {
                this.image = image;
            },
            paintSelf: function() {
                var realWidth = Math.round(this.image.width * config.SCALEX),
                    realHeight = Math.round(this.image.height * config.SCALEY);

                config.CONTEXT.drawImage(this.image, this.x, this.y, realWidth, realHeight);
            },
            killSelf: function() {
                this.alive = false;
            },
            destorySelf: function() {
                this.destory = true;
            },
            loseLife: function(minus) {
                minus = minus || 1;

                if ((this.life -= minus) <= 0) {
                    model.orphan = model.orphan.concat(this.bullets);
                    this.killSelf();
                }
            },
            changePos: function(newX, newY) {
                this.x = newX;
                this.y = newY;
            }
        };

        // bullet constructor function
        factory.Bullet = function(setting) {
            this.destory = false;
            this.speedX = setting.speedX || 0;
            this.speedY = setting.speedY || 0;
            this.hit = setting.hit || 1;

            factory.Sharp.call(this, setting);
        };

        factory.Bullet.prototype = Object.create(factory.Sharp.prototype);
        factory.Bullet.prototype.constructor = factory.Bullet;

        utile.extend(factory.Bullet.prototype, {
            move: function() {
                if (state.period === config.STATES.RUNNING && !this.destory) {
                    this.y += this.speedY;
                    this.speedX && (this.x += this.speedX);

                    this.speedY > 0 ?
                        (this.y >= config.HEIGHT && this.destorySelf()) :
                        (this.y <= 0 && this.destorySelf());

                    this.speedY < 0 && this.speedX < 0 &&
                        this.x + this.speedX <= 0 && (this.speedX = -this.speedX);
                    this.speedY < 0 && this.speedX > 0 &&
                        this.x + this.speedX >= config.WIDTH && (this.speedX = -this.speedX);
                }
            }
        });

        // Jet constructor function
        factory.Jet = function(setting) {
            factory.Sharp.call(this, setting);

            this.destory = false;
            this.counter = 0;
            this.alive = true;
            this.bullets = [];
            this.life = setting.life || Infinity;
            this.speedX = setting.speedX || 0;
            this.speedY = setting.speedY || 0;
            this.dead = setting.dead || [];
            this.kind = setting.kind || 0;
            this.rate = setting.rate || 500;
            this.hit = setting.hit || 1;
            this.mutiBullets = setting.mutiBullets || [];
            this.last = Date.now();
        };

        factory.Jet.prototype = Object.create(factory.Sharp.prototype);
        factory.Jet.prototype.constructor = factory.Jet;
        factory.Jet.prototype.bulletImg = config.IMGS.bulletJ;

        utile.extend(factory.Jet.prototype, {
            move: function() {
                var num, sign, nextPosX,
                    maxTry = 5;

                if (state.period === config.STATES.RUNNING && !this.destory) {
                    // change x position
                    !this.kind && (this.x += this.speedX); // case 1
                    nextPosX = this.x + this.speedX;

                    if (nextPosX <= 0 || nextPosX > config.WIDTH && this.speedX) {
                        this.speedX < 0 ?
                            (this.speedX = utile.random(0, -this.speedX)) :
                            (this.speedY = utile.random(-this.speedX, 0));
                    }

                    while (this.kind && maxTry--) {
                        num = utile.random(0, 100);
                        sign = num > 6 ? 0 : num < 3 ? -1 : 1;

                        this.x += sign * utile.random(0, 5);

                        if (this.x > 0 && this.x < config.WIDTH) {
                            break;
                        }
                    } // case 2

                    // change y position
                    (this.y += this.speedY) >= config.HEIGHT && this.killSelf();

                    if (!this.alive) {
                        this.changeImage(this.dead[this.counter++]);
                        this.counter >= this.dead.length && this.destorySelf();
                    }
                }
            },
            isCollide: function(sharp) {
                var center = {
                        cx: this.x + this.image.width / 2,
                        cy: this.y + this.image.height / 2
                    },
                    radius = Math.min(this.image.width / 2, this.image.height / 2),
                    centerS = {},
                    radiusS = 0,
                    distance = Infinity;

                if (sharp instanceof factory.Bullet) {
                    distance = Math.sqrt(Math.pow(sharp.x - center.cx, 2) +
                        Math.pow(sharp.y - center.cy, 2));

                    return distance < radius;
                } else {
                    centerS.cx = sharp.x + sharp.image.width / 2;
                    centerS.cy = sharp.y + sharp.image.height / 2;
                    radiusS = Math.min(sharp.image.width / 2, sharp.image.height / 2);
                    distance = Math.sqrt(Math.pow(centerS.cx - center.cx, 2) +
                        Math.pow(centerS.cy - center.cy, 2));

                    return distance < (radius + radiusS);
                }
            },
            shot: function(posX, posY) {
                var that = this,
                    num = utile.random(0, 100);

                posX = posX || that.x + that.image.width / 2 - that.bulletImg.width / 2;
                posY = posY || that.y;

                if (state.period === config.STATES.RUNNING) {
                    if (utile.isTimeout(this.rate, this.last)) {
                        this.mutiBullets.forEach(function(speed) {
                            that.bullets.push(new factory.Bullet({
                                x: posX,
                                y: posY,
                                image: that.bulletImg,
                                speedX: speed[0],
                                speedY: speed[1],
                                hit: that.hit
                            }));
                        });

                        this.last = Date.now();
                    }

                    utile.removeGone(this.bullets);
                    this.bullets.forEach(function(bullet) {
                        bullet.move();
                        viewer.enequeue(bullet);
                    });
                }
            }
        });

        // LoadingJet constructor function
        factory.LoadingJet = function(setting) {
            factory.Jet.call(this, setting);
        };

        factory.LoadingJet.prototype = Object.create(factory.Jet.prototype);
        factory.LoadingJet.prototype.constructor = factory.LoadingJet;

        utile.extend(factory.LoadingJet.prototype, {
            move: function() {
                if (state.period === config.STATES.LOADING) {
                    this.changeImage(this.dead[this.counter++]);
                    this.counter >= this.dead.length &&
                        (this.destorySelf(), state.period = config.STATES.RUNNING);
                }
            }
        });

        // hero constructor function
        factory.Hero = function(setting) {
            var onlyHero = null,
                proto = factory.Hero.prototype;

            utile.extend(setting, {
                mutiBullets: [
                    [-4, -6],
                    [0, -6],
                    [4, -6]
                ]
            });

            factory.Jet.call(this, setting);

            // add new property
            this.energy = 1;

            // save hero
            onlyHero = this;

            // 单例模式
            factory.Hero = function() {
                return onlyHero;
            };

            // 重新设置继承
            factory.Hero.prototype = proto;
            proto.constructor = factory.Hero;
        };

        factory.Hero.prototype = Object.create(factory.Jet.prototype);
        factory.Hero.prototype.constructor = factory.Hero;

        utile.extend(factory.Hero.prototype, {
            bulletImg: config.IMGS.bullet,
            loseLife: function() {
                var that = this;

                function loseLifeAnimation() {
                    that.changeImage(that.dead[that.counter++]);

                    if (that.counter >= that.dead.length) {
                        if (--that.life <= 0) {
                            that.destorySelf();
                            state.period = config.STATES.GAMEOVER;
                        } else {
                            setTimeout(function() {
                                that.alive = true;
                            }, config.TIME); // 无敌时间
                        }

                        that.counter = 0;
                        that.image = config.IMGS.heros[0];
                    } else {
                        setTimeout(loseLifeAnimation, state.interval * 5);
                    }
                }

                // add new loseLife to Hero instance
                this.loseLife = function() {
                    this.killSelf();
                    !this.alive && setTimeout(loseLifeAnimation, 0);
                };

                this.loseLife(); // run new method now
            }
        });

        factory.Hero.prototype.mousemoveHandle = function(event) {
            if (state.period === config.STATES.RUNNING) {
                var event = event || window.event;
                console.log(event.offsetX, event.offsetY);
                this.changePos(event.offsetX - this.image.width / 2,
                    event.offsetY - this.image.height / 2);
            }
        };

        // enemy Jet constructor method
        factory.EnemyJet = function(setting) {
            var prob = setting.prob,
                image = config.IMGS[this.imgMap[prob]];

            // recheck imgae
            image = Array.isArray(image) ? image[0] : image;

            utile.extend(setting, {
                x: utile.random(0, config.WIDTH - image.width),
                y: -image.height,
                image: image,
                dead: config.IMGS[this.deadImgMap[prob]],
                life: this.lifeMap[prob],
                rate: this.rateMap[prob],
                speedY: setting.speedY || this.speedYMap[prob],
                kind: this.randomXMap[prob],
                mutiBullets: this.mutiBulletsMap[prob]
            });

            factory.Jet.call(this, setting);

            // score of kill enemy
            this.score = this.life;
        };

        factory.EnemyJet.prototype = Object.create(factory.Jet.prototype);
        factory.EnemyJet.prototype.constructor = factory.EnemyJet;

        utile.extend(factory.EnemyJet.prototype, {
            imgMap: ['enemyS', 'enemyM', 'enemyB'],
            deadImgMap: ['enemySdown', 'enemyMdown', 'enemyBdown'],
            lifeMap: [2, 6, 32],
            rateMap: [Infinity, 500, 2000],
            speedYMap: [8, 4, 1],
            randomXMap: [0, 0, 1],
            mutiBulletsMap: [
                [],
                [[0, 8]],
                [[-6, -2], [-4, -5], [0, -7], [-7, 0], [-6, 2], [-4, 5], [0, 6], [4, 5], [6, 2], [7, 0], [4, -5], [6, -2]]
            ],
            destorySelf: function() {
                this.destory = true;
                state.score += this.score;
            }
        });

        // Goods constructor function
        factory.Goods = function(setting) {
            var image = config.IMGS[this.goodsMap[setting.prob]];

            utile.extend(setting, {
                x: utile.random(50, config.WIDTH - 50),
                y: -image.height,
                image: image
            });

            factory.Sharp.call(this, setting);

            this.speedX = 0;
            this.speedY = 10;
            this.goods = this.goodsMap[setting.prob];
        };

        factory.Goods.prototype = Object.create(factory.Sharp.prototype);
        factory.Goods.prototype.constructor = factory.Goods;

        utile.extend(factory.Goods.prototype, {
            goodsMap: ['energy', 'life', 'hit'],
            move: function() {
                var num, sign,
                    maxTry = 5;

                if (state.period === config.STATES.RUNNING) {
                    while (maxTry--) {
                        num = utile.random(0, 100);
                        sign = num > 20 ? 0 : (num < 10 ? -1 : 1);

                        this.x += sign * utile.random(5, 10);

                        if (this.x > 0 && this.x < config.WIDTH) {
                            break;
                        }
                    }

                    this.y += utile.random(2, 4);
                }

                if (this.y > config.HEIGHT || this.x < 0 || this.x > config.WIDTH) {
                    this.destorySelf();
                }
            }
        });

    }());

    GAME.viewer = viewer = {
        queue: [],
        enequeue: function(sharp) {
            this.queue.length === 0 &&
                setTimeout(this.trigger.bind(this), 0);
            this.queue.push(sharp);
        },
        dequeue: function() {
            return this.queue.shift();
        },
        trigger: function() {
            while (this.queue.length) {
                this.dequeue().paintSelf();
            }
        }
    };

    GAME.model = model = {
        bg: [
            new factory.Sharp({
                y: -config.HEIGHT,
                image: config.IMGS.bg
            }),
            new factory.Sharp({
                image: config.IMGS.bg
            }),
            new factory.Sharp({
                image: config.IMGS.start
            })
        ],
        loading: new factory.LoadingJet({
            image: config.IMGS.loading[0],
            dead: config.IMGS.loading
        }),
        hero: new factory.Hero({
            y: config.HEIGHT,
            image: config.IMGS.heros[0],
            dead: config.IMGS.heroBlowup,
            life: config.TOTALLIFE,
            rate: 400
        }),
        enemyJets: [],
        gameover: new factory.Sharp({
            x: -20,
            image: config.IMGS.gameover
        }),
        orphan: [],
        goods: []
    };

    GAME.controler = controler = {
        noop: function() { /* noop */ },
        always: function() { /* noop */ },
        start: function() {
            var offset = -config.HEIGHT,
                step = config.BGSTEP;

            // add user click handle
            config.CANVAS.addEventListener('click', function() {
                if (state.period === config.STATES.START) {
                    model.bg.pop();
                    controler.always = controler.start;
                    state.period = config.STATES.LOADING;
                }
            });

            controler.start = function() {
                if (state.period <= config.STATES.RUNNING) {
                    (offset += step) >= 0 &&
                        (offset = -config.HEIGHT);

                    model.bg[0].changePos(0, offset);
                    model.bg[1].changePos(0, config.HEIGHT + offset);

                    model.bg.forEach(function(sharp) {
                        viewer.enequeue(sharp);
                    });
                }
            };
        },
        loading: function() {
            model.loading.killSelf();
            model.loading.changePos(0, config.HEIGHT - config.IMGS.loading[0].height);

            setTimeout(function _loading() {
                var load = model.loading;

                load.move();
                load.counter >= load.dead.length ?
                    (state.period = config.STATES.RUNNING) :
                    setTimeout(_loading, state.interval * 10);
            }, 0);

            // rewrite loading method
            controler.loading = function() {
                viewer.enequeue(model.loading);
            };
        },
        running: function() {
            var countDown = 10,
                binCount = 0,
                heroCanShot = false,
                IMGS = config.IMGS,
                normalJetLast = Date.now(),
                fastJetLast = Date.now(),
                goodsLast = Date.now();

            // hero show animation
            setTimeout(function _heroAnimation() {
                model.hero.changePos((config.WIDTH - model.hero.image.width) / 2,
                    model.hero.y - 20);

                if (--countDown) {
                    setTimeout(_heroAnimation, state.interval);
                } else {
                    config.CANVAS.addEventListener('mousemove',
                        model.hero.mousemoveHandle.bind(model.hero));
                    heroCanShot = true;
                }
            }, 0);

            // rewrite running method
            controler.running = function() {
                var num = utile.random(0, 100);

                if (state.period === config.STATES.RUNNING) {
                    // add normal enemy Jet
                    if (utile.isTimeout(config.ENEMYRATE, normalJetLast)) {
                        model.enemyJets.push(
                            new factory.EnemyJet({
                                prob: num < 80 ? 0 : (num > 98 ? 2 : 1)
                            }));

                        normalJetLast = Date.now();
                    }

                    // add fast enemy Jet
                    if (utile.isTimeout(utile.random(5000, 10000), fastJetLast)) {
                        num = utile.random(1, 3);

                        for (; num > 0; --num) {
                            model.enemyJets.push(
                                new factory.EnemyJet({
                                    prob: 0,
                                    speedX: utile.random(-8, 8),
                                    speedY: 20
                                }));
                        }

                        fastJetLast = Date.now();
                    }

                    // goods generate
                    if (utile.isTimeout(40000, goodsLast)) {
                        num = utile.random(0, 100);
                        num = num > 50 ? 0 : (num < 25 ? 1 : 2);

                        model.goods.push(
                            new factory.Goods({
                                prob: num
                            }));

                        goodsLast = Date.now();
                    }
                }

                // enemy Jets move and paint
                model.enemyJets.forEach(function(jet) {
                    var posX = jet.x + jet.image.width / 2 - jet.bulletImg.width / 2,
                        posY = jet.y + jet.image.height;

                    viewer.enequeue(jet);
                    state.period === config.STATES.RUNNING &&
                        (jet.move(), jet.shot(posX, posY));
                });
                utile.removeGone(model.enemyJets);

                // hero move and paint
                if (model.hero.alive) {
                    binCount = (++binCount) % 2;
                    model.hero.changeImage(config.IMGS.heros[binCount]);
                }
                viewer.enequeue(model.hero);
                state.period === config.STATES.RUNNING &&
                    heroCanShot && model.hero.shot();

                // crash check
                model.enemyJets.forEach(function(jet) {
                    // 战机是否相撞
                    if (jet.isCollide(model.hero) && model.hero.alive) {
                        jet.killSelf();
                        model.hero.loseLife();
                    }

                    // 敌机的子弹打到我的英雄
                    jet.bullets.forEach(function(bullet) {
                        if (model.hero.isCollide(bullet) && model.hero.alive) {
                            model.hero.loseLife();
                            bullet.destorySelf();
                        }
                    });

                    // 我的子弹击中敌机
                    model.hero.bullets.forEach(function(bullet) {
                        if (jet.isCollide(bullet)) {
                            jet.loseLife(bullet.hit);
                            bullet.destorySelf();
                        }
                    });
                });

                // 孤儿子弹是否打中英雄
                utile.removeGone(model.orphan);
                model.orphan.forEach(function(bullet) {
                    if (model.hero.isCollide(bullet) && model.hero.alive) {
                        model.hero.loseLife();
                        bullet.destorySelf();
                    }

                    bullet.move();
                    viewer.enequeue(bullet);
                });

                // 物品移动和捕获检测
                utile.removeGone(model.goods);
                model.goods.forEach(function(item) {
                    if (model.hero.isCollide(item)) {
                        model.hero[item.goods]++;
                        item.destorySelf();
                    }

                    item.move();
                    viewer.enequeue(item);
                });

                // check keypress
                state.period !== config.STATES.PAUSED &&
                    utile.setStateByCode(config.SPACE, config.STATES.PAUSED);

                if (state.keyCode === config.KILLALLJET && model.hero.energy) {
                    model.enemyJets.forEach(function(jet) {
                        jet.killSelf();
                    });

                    model.orphan.forEach(function(bullet) {
                        bullet.destorySelf();
                    });

                    model.hero.energy--;
                    state.keyCode = config.NOTPRESS;
                }

                // refresh infomation
                utile.refreshInfo(model.hero);
            };

            controler.running();
        },
        resuem: function() {
            utile.setStateByCode(config.SPACE, config.STATES.RUNNING);
        },
        gameover: function() {
            viewer.enequeue(model.gameover);
            controler.gameover = controler.noop;
        }
    };

    // game start
    (function() {
        var stateFuncMap = [
            'start', 'loading', 'running', 'resuem', 'gameover'
        ];

        // game loop
        setInterval(function game() {
            controler.always();
            controler[stateFuncMap[state.period]]();
        }, state.interval);

        // add keypress handle
        window.addEventListener('keypress', function(event) {
            var event = event || window.event;
            state.keyCode = event.keyCode;
        });
    }());

}(document.getElementById('plane'), {}, imgs));
