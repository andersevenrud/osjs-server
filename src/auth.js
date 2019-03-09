/**
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2019, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

const signale = require('signale').scope('auth');
const nullAdapter = require('./adapters/auth/null.js');

/**
 * Authentication Handler
 */
class Auth {

  /**
   * Creates a new instance
   * @param {Core} core Core instance reference
   * @param {Object} options Service Provider arguments
   */
  constructor(core, options) {
    this.core = core;
    this.options = Object.assign({
      adapter: nullAdapter
    }, options);

    try {
      this.adapter = this.options.adapter(core, this.options.config);
    } catch (e) {
      console.warn(e);
      this.adapter = nullAdapter(core, this.options.config);
    }
  }

  /**
   * Destroys instance
   */
  destroy() {
    if (this.adapter.destroy) {
      this.adapter.destroy();
    }
  }

  /**
   * Initializes adapter
   */
  async init() {
    if (this.adapter.init) {
      await this.adapter.init();
    }
  }

  /**
   * Performs a login request
   * @param {Object} req HTTP request
   * @param {Object} res HTTP response
   */
  async login(req, res) {
    const result = await this.adapter.login(req, res);

    if (result) {
      const ignores = ['password'];
      const required = ['username', 'id'];
      const template = {
        id: 0,
        username: req.body.username,
        name: req.body.username,
        groups: this.core.config('auth.defaultGroups', [])
      };

      const missing = required
        .filter(k => typeof result[k] === 'undefined');

      if (missing.length) {
        signale.warn('Missing user attributes', missing);
      } else {
        const useResult = Object.assign({}, template, Object.keys(result)
          .filter(k => ignores.indexOf(k) === -1)
          .reduce((o, k) => Object.assign(o, {[k]: result[k]}), {}));

        req.session.user = useResult;
        req.session.save(() => res.json(useResult));

        return;
      }
    }

    res.status(403)
      .json({error: 'Invalid login'});
  }

  /**
   * Performs a logout request
   * @param {Object} req HTTP request
   * @param {Object} res HTTP response
   */
  async logout(req, res) {
    await this.adapter.logout(req, res);

    try {
      req.session.destroy();
    } catch (e) {
      signale.warn(e);
    }

    res.json({});
  }
}

module.exports = Auth;