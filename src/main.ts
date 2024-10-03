// Importation des différentes bibliothèques et modules utilisés
import {
  Viewer, // Afficheur 3D pour visualiser les modèles
  DefaultViewerParams, // Paramètres par défaut du viewer
  SpeckleLoader, // Chargeur de modèles Speckle
  UrlHelper, // Aide à la gestion des URLs Speckle
  TreeNode, // Représente un nœud d'arbre dans le modèle 3D
  SelectionEvent, // Événements de sélection dans la scène
  SelectionExtension, // Extension pour sélectionner des objets dans la scène
  CameraController, // Contrôleur de caméra pour naviguer dans la scène
  ViewerEvent, // Gestion des événements dans le viewer
  NodeData, // Structure de données associée à un nœud dans le viewer
  SectionTool, // Outil pour créer des sections de modèle
  SectionOutlines, // Outil pour afficher les contours des sections
  MeasurementsExtension, // Extension pour effectuer des mesures dans la scène
} from '@speckle/viewer';

import { makeMeasurementsUI } from './MeasurementsUI'; // Interface utilisateur pour les mesures
import { Pane } from 'tweakpane'; // Bibliothèque pour créer une interface utilisateur (boutons, menus, etc.)
import { Box3 } from 'three'; // Utilisé pour gérer des boîtes englobantes en 3D
import { Spinner } from 'spin.js'; // Bibliothèque pour afficher un indicateur de chargement


// Fonction principale qui gère l'initialisation et les interactions avec la maquette 3D
async function main() {
   /** Configurer le spinner */
   const spinnerTarget = document.getElementById('spinner') as HTMLElement;
   const loadingSpinner = new Spinner({
     lines: 8, // Nombre de lignes du cercle
     length: 7, // Longueur de chaque ligne
     width: 3, // Largeur des lignes
     radius: 5, // Rayon du cercle
     scale: 1, // Échelle du spinner
     corners: 1, // Rond des coins
     color: '#000', // Couleur
     rotate: 0, // Rotation initiale
     direction: 1, // Sens de la rotation
     speed: 1, // Vitesse de rotation
     zIndex: 2e9, // Z-index
     top: '0%', // Position top
     left: '50%', // Position left
     position: 'absolute', // Positionnement
   });
 
   // Démarrer le spinner
   loadingSpinner.spin(spinnerTarget);

  /** Sélectionner le conteneur HTML où afficher la maquette */
  const container = document.getElementById('renderer') as HTMLElement;

  /** Configuration des paramètres du viewer */
  const params = DefaultViewerParams;
  params.verbose = true; // Activer les logs pour obtenir plus de détails

  /** Création du viewer (afficheur) */
  const viewer = new Viewer(container, params);
  /** Initialisation du viewer */
  await viewer.init();

  /** Ajouter l'extension de contrôle de la caméra pour naviguer dans la scène */
  const cameraController = viewer.createExtension(CameraController);


  /** Ajouter l'extension de mesures (pour effectuer des mesures dans la scène) */
  const measurements = viewer.createExtension(MeasurementsExtension);
  const selection = viewer.createExtension(SelectionExtension); // Extension pour sélectionner des objets
  const sections = viewer.createExtension(SectionTool); // Extension pour découper des sections de modèle
  viewer.createExtension(SectionOutlines); // Extension pour afficher les contours des sections

  /** Charger les ressources du modèle 3D depuis une URL Speckle */
  const urls = await UrlHelper.getResourceUrls(
    'https://app.speckle.systems/projects/1674b7fa1e/models/9f53886518'
  );
  for (const url of urls) {
    const loader = new SpeckleLoader(viewer.getWorldTree(), url, '');
    /** Charger les données du modèle 3D */
    await viewer.loadObject(loader, true);
  }
 // Arrêter le spinner et cacher l'élément lorsque le chargement est terminé
  loadingSpinner.stop();
  const loadingDiv = document.getElementById('loading-spinner') as HTMLElement;
  if (loadingDiv) {
    loadingDiv.style.display = 'none'; // Cacher l'élément
  }

  // Désactiver les mesures par défaut
  measurements.enabled = false;
  // Appeler la fonction pour ajouter l'interface des mesures
  makeMeasurementsUI(viewer);

  // Créer une map pour stocker les éléments du modèle par leur identifiant
  const treeNodeMap = new Map<string, TreeNode>();

  // Récupérer tous les éléments ayant un identifiant unique dans leurs propriétés
  const tn_GenericModels: TreeNode[] = viewer
    .getWorldTree()
    .findAll(
      (node: TreeNode) =>
        node.model.raw.properties && node.model.raw.properties.id
    );

  // Remplir la map avec les éléments en utilisant leur identifiant
  tn_GenericModels.forEach((node) => {
    treeNodeMap.set(node.model.raw.properties.id, node);
  });

  /** Activer l'outil de section pour découper des parties du modèle */
  sections.toggle();

  /** Appliquer une boîte de section (zone à découper dans le modèle) */
  const box = new Box3().copy(viewer.getRenderer().sceneBox);
  box.max.z *= 1;
  box.min.z = -1;
  sections.setBox(box);

  /** Ajouter un panneau de contrôle avec des boutons et des menus */
  const pane = new Pane({ title: 'Control Panel', expanded: false });

  /** Ajuster la position et la largeur du panneau pour qu'il corresponde au premier panneau */
  const firstPaneElement = document.querySelector('.tp-dfwv') as HTMLElement;
  const paneElement = pane.element as HTMLElement;
  paneElement.style.position = 'absolute'; // Positionner le panneau de façon absolue
  paneElement.style.left = '1px'; // Aligner le panneau à gauche

  // Fonction pour ajuster la position du panneau en fonction de la hauteur de l'autre panneau
  function adjustControlPanelPosition() {
    if (firstPaneElement) {
      const firstPaneWidth = firstPaneElement.offsetWidth; // Obtenir la largeur du premier panneau
      paneElement.style.width = `${firstPaneWidth}px`; // Ajuster la largeur du panneau
      const isExpanded = firstPaneElement.clientHeight > 40; // Vérifier si le panneau est déployé
      paneElement.style.top = isExpanded
        ? `${firstPaneElement.clientHeight + 10}px`
        : '40px'; // Ajuster la hauteur
    }
  }

  // Appeler la fonction pour ajuster la position au départ
  adjustControlPanelPosition();

  // Surveiller les changements de taille du premier panneau pour repositionner le panneau de contrôle
  const observer = new MutationObserver(adjustControlPanelPosition);
  observer.observe(firstPaneElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  /** Bouton pour activer/désactiver les boîtes de section */
  let sectionEnabled = true;
  (pane as any).addButton({ title: 'Toggle Section Boxes' }).on('click', () => {
    sectionEnabled = !sectionEnabled;
    sections.enabled = sectionEnabled; // Activer/désactiver les sections
  });

  /** Bouton pour réinitialiser les boîtes de section à leur état d'origine */
  (pane as any).addButton({ title: 'Reset Section Boxes' }).on('click', () => {
    const initialBox = new Box3().copy(viewer.getRenderer().sceneBox); // Reprendre la boîte englobante d'origine
    initialBox.max.z *= 1;
    initialBox.min.z = -1;
    sections.setBox(initialBox); // Appliquer la boîte de section réinitialisée
  });

  let btnUrlDoc: any = null;

  // Fonction pour supprimer le bouton actuel et créer un nouveau bouton en fonction de l'URL
  function createOrUpdateButton(parameterUrl: string | null) {
    // Supprimer l'ancien bouton s'il existe
    if (btnUrlDoc) {
      (pane as any).remove(btnUrlDoc);
    }

    // Créer un nouveau bouton : soit activé avec l'URL, soit désactivé si l'URL est nulle
    if (parameterUrl && parameterUrl.trim() !== '') {
      btnUrlDoc = (pane as any)
        .addButton({
          title: 'Ouvrir URL',
          disabled: false,
          label: 'Doc',
        })
        .on('click', () => {
          window.open(parameterUrl, '_blank'); // Ouvrir l'URL dans un nouvel onglet
        });
    } else {
      btnUrlDoc = (pane as any).addButton({
        title: 'Ouvrir URL',
        disabled: true,
        label: 'Doc',
      });
    }
  }

  // Menu déroulant pour sélectionner un élément (Catalyseur, Échappement, ou Tous)
  (pane as any)
    .addBlade({
      view: 'list',
      label: 'Éléments',
      options: [
        { text: 'Catalyseur', value: 'catalyseur' },
        { text: 'Échappement', value: 'echappement' },
        { text: 'All', value: 'all' },
      ],
      value: 'all', // Valeur par défaut "All"
    })
    .on('change', (ev: any) => {
      let tnFinded: TreeNode = null;

      switch (ev.value) {
        case 'all':
          // Réinitialiser la caméra à sa position de départ si "All" est sélectionné
          selection.clearSelection();
          cameraController.setCameraView([], false); // Remettre la caméra à la vue générale
          createOrUpdateButton(null); // Désactiver le bouton d'URL
          break;
        case 'echappement':
          // Sélectionner l'ID pour l'échappement
          tnFinded = treeNodeMap.get('43f5ec360a6eb64885aef52d54281f2f');
          break;
        case 'catalyseur':
          // Sélectionner l'ID pour le catalyseur
          tnFinded = treeNodeMap.get('7d99a80b449d360e6380c0108737ae1a');
          break;
      }

      // Si un nœud est trouvé, zoomer dessus
      if (tnFinded) {
        ZoomOnTreeNode(tnFinded);
      } else {
        console.log(`Impossible de trouver le node pour l'élément ${ev.value}`);
      }
    });

  // Fonction pour zoomer sur un TreeNode (élément) spécifique
  function ZoomOnTreeNode(targetTreeNode: TreeNode): void {
    selection.clearSelection(); // Effacer les sélections précédentes
    const ids = [targetTreeNode.model.id]; // Obtenir l'ID du nœud pour zoomer dessus
    cameraController.setCameraView(ids, true); // Appliquer le zoom

    // Extraire les données utilisateur de l'élément, y compris l'URL
    const properties = targetTreeNode.model.raw?.properties;
    const userData = properties?.['Données utilisateur'] || {};
    const parameterUrl = userData.URL_DOC || null;

    // Créer ou mettre à jour le bouton avec l'URL de l'élément
    createOrUpdateButton(parameterUrl);
  }

  // Gestion du clic sur un objet dans la scène 3D
  viewer.on(ViewerEvent.ObjectClicked, (selectionEvent: SelectionEvent | null) => {
    if (selectionEvent && selectionEvent.hits) {
      const treeNode: TreeNode = selectionEvent.hits[0].node;
      const treeNodeData: NodeData = treeNode.model;

      // Extraire les propriétés de l'élément sélectionné
      const properties = treeNodeData.raw?.properties;
      const userData = properties?.['Données utilisateur'] || {};
      const parameterUrl = userData.URL_DOC || null;

      // Créer ou mettre à jour le bouton avec l'URL correspondante
      createOrUpdateButton(parameterUrl);
    }
  });
}

// Lancer la fonction principale
main();
