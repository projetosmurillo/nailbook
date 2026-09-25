/**
 * NAILBOOK — Controlador de Settings
 */

import { Setting } from '../models/index.js';
import { Service } from '../models/index.js';

const settingsController = {
  /**
   * Obter configurações do negócio
   */
  async find() {
    return Setting.find();
  },

  /**
   * Obter serviços ativos
   */
  async getServices() {
    return Service.findAll(true);
  }
};

export default settingsController;
