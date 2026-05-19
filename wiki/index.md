---
layout: doc
---

<div class="browiki-homepage">

  <!-- Welcome Header Banner -->
  <div class="wiki-welcome-banner">
    <div class="banner-content">
      <h1>Bem-vindo à Wiki do Narrador! ⚔️</h1>
      <p>A enciclopédia oficial da nossa campanha de RPG no sistema <strong>Mighty Blade</strong>.</p>
      <div class="banner-stats">
        <span>🛡️ <strong>33+</strong> Guias de Regras</span>
        <span>👥 <strong>5+</strong> Personagens Ativos</span>
        <span>📖 <strong>100%</strong> Integrada ao Mestre</span>
      </div>
    </div>
    <div class="banner-avatar">
      <img src="/icon.png" alt="O Narrador Logo" />
    </div>
  </div>

  <!-- Main Grid Columns (bRO Wiki Style) -->
  <div class="wiki-grid">
    
    <!-- Left Column: Quick Navigation Guides -->
    <div class="wiki-col">
      <div class="wiki-section-card">
        <div class="card-header font-outfit">🔥 Classes de Mighty Blade</div>
        <div class="card-body">
          <p>Escolha uma classe para ver suas habilidades automáticas, atributos sugeridos e evolução:</p>
          <ul class="wiki-link-list">
            <li>⚔️ <a href="/Regras/Guerreiro__Classe_">Guerreiro</a> - O mestre do combate corporal.</li>
            <li>🪄 <a href="/Regras/Feiticeiro__Classe_">Feiticeiro</a> - Manipulador de mana e magias arcanas.</li>
            <li>🗡️ <a href="/Regras/Ladino__Classe_">Ladino</a> - Especialista em furtividade e precisão.</li>
            <li>🛡️ <a href="/Regras/Paladino__Classe_">Paladino</a> - O guerreiro sagrado abençoado pelos deuses.</li>
            <li>🏹 <a href="/Regras/Patrulheiro__Classe_">Patrulheiro</a> - O rastreador das selvas e mestre do arco.</li>
            <li>📜 <a href="/Regras/Sacerdote__Classe_">Sacerdote</a> - Curandeiro e canalizador do poder divino.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Center Column: Core Rules & Guides -->
    <div class="wiki-col">
      <div class="wiki-section-card">
        <div class="card-header font-outfit">📖 Regras do Jogo</div>
        <div class="card-body">
          <p>Explore as mecânicas centrais para entender como realizar testes e combate na mesa:</p>
          <ul class="wiki-link-list">
            <li>🎲 <a href="/Regras/Testes_de_Atributo">Testes de Atributo</a> - Como rolar dados (2d6 + atributo).</li>
            <li>⚔️ <a href="/Regras/Combate">Regras de Combate</a> - Rodadas, iniciativa e turnos.</li>
            <li>💥 <a href="/Regras/Ações_em_Combate">Ações em Combate</a> - Movimentos, esquiva e ataques.</li>
            <li>🛡️ <a href="/Regras/Ataque_e_Defesa">Ataque e Defesa</a> - Como calcular acertos e bloqueios.</li>
            <li>✨ <a href="/Regras/Magia">Uso de Magia</a> - Escolas de magia, conjuração e PM.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Right Column: Campaign Information -->
    <div class="wiki-col">
      <div class="wiki-section-card highlight-card">
        <div class="card-header font-outfit">👥 Personagens Jogadores</div>
        <div class="card-body">
          <p>Fichas oficiais dos heróis em desenvolvimento na nossa mesa:</p>
          <ul class="wiki-link-list">
            <li>🛡️ <a href="/NPCs/André">André</a> - Paladino Adaptável de Nível 1.</li>
          </ul>
          <hr/>
          <p class="small-text">O Mestre atualiza esta wiki em tempo real durante as sessões sempre que novos NPCs são introduzidos ou eventos acontecem.</p>
        </div>
      </div>
    </div>

  </div>

</div>

<style>
/* Custom bRO Wiki styles for homepage layout */
.browiki-homepage {
  margin-top: 1rem;
}

.wiki-welcome-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.03));
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.banner-content h1 {
  font-size: 2.2rem !important;
  font-weight: 700;
  margin-bottom: 0.5rem !important;
  border-bottom: none !important;
  padding-bottom: 0 !important;
}

.banner-content p {
  font-size: 1.1rem;
  color: var(--vp-c-text-2);
  margin-bottom: 1.5rem;
}

.banner-stats {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.banner-stats span {
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  padding: 0.4rem 0.8rem;
  border-radius: 99px;
  font-size: 0.9rem;
}

.banner-avatar img {
  width: 120px;
  height: 120px;
  object-fit: contain;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.1));
}

.wiki-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.wiki-section-card {
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  height: 100%;
}

.wiki-section-card.highlight-card {
  border-color: rgba(99, 102, 241, 0.3);
  background: linear-gradient(180deg, var(--vp-c-bg-soft) 80%, rgba(99, 102, 241, 0.02) 100%);
}

.wiki-section-card .card-header {
  background-color: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-divider);
  padding: 0.8rem 1.2rem;
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--vp-c-text-1);
}

.wiki-section-card .card-body {
  padding: 1.2rem;
}

.wiki-link-list {
  list-style: none !important;
  padding-left: 0 !important;
  margin: 1rem 0 0 0 !important;
}

.wiki-link-list li {
  margin-bottom: 0.8rem !important;
  line-height: 1.5;
  font-size: 0.95rem;
}

.wiki-link-list a {
  font-weight: 600;
  text-decoration: none;
}

.wiki-link-list a:hover {
  text-decoration: underline;
}

.small-text {
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
  line-height: 1.4;
}

@media (max-width: 768px) {
  .wiki-welcome-banner {
    flex-direction: column-reverse;
    text-align: center;
    gap: 1.5rem;
  }
  
  .banner-stats {
    justify-content: center;
  }
}
</style>
