import { expect } from '@open-wc/testing';
import {
  projectState,
  projectLoadingState,
  bmadServicesAvailable$,
  projectName$,
  setProjectLoading,
  setProjectSuccess,
  setProjectError,
  clearProject,
} from '../../../src/state/project.state.ts';
import type { ProjectData } from '../../../src/types/project.ts';

const mockProject: ProjectData = {
  projectName: 'test-project',
  projectRoot: '/path/to/test-project',
  bmadLoaded: true,
  services: {
    config: true,
    phases: true,
    agents: true,
    status: true,
    artifacts: true,
    watcher: true,
  },
};

beforeEach(() => {
  clearProject();
});

describe('ProjectState', () => {
  describe('initial state', () => {
    it('starts with null project', () => {
      expect(projectState.get()).to.be.null;
    });

    it('starts with idle loading state', () => {
      expect(projectLoadingState.get().status).to.equal('idle');
    });

    it('derived bmadServicesAvailable$ is false initially', () => {
      expect(bmadServicesAvailable$.get()).to.be.false;
    });

    it('derived projectName$ is null initially', () => {
      expect(projectName$.get()).to.be.null;
    });
  });

  describe('setProjectLoading', () => {
    it('sets loading status', () => {
      setProjectLoading();
      expect(projectLoadingState.get().status).to.equal('loading');
    });
  });

  describe('setProjectSuccess', () => {
    it('sets project data and success status', () => {
      setProjectSuccess(mockProject);

      expect(projectState.get()).to.deep.equal(mockProject);
      expect(projectLoadingState.get().status).to.equal('success');
    });

    it('updates derived signals', () => {
      setProjectSuccess(mockProject);

      expect(bmadServicesAvailable$.get()).to.be.true;
      expect(projectName$.get()).to.equal('test-project');
    });

    it('bmadServicesAvailable$ is false when bmadLoaded is false', () => {
      setProjectSuccess({ ...mockProject, bmadLoaded: false });
      expect(bmadServicesAvailable$.get()).to.be.false;
    });
  });

  describe('setProjectError', () => {
    it('clears project data and sets error', () => {
      setProjectSuccess(mockProject);
      setProjectError('Something went wrong', 'test_error');

      expect(projectState.get()).to.be.null;
      const loadState = projectLoadingState.get();
      expect(loadState.status).to.equal('error');
      expect(loadState.error).to.equal('Something went wrong');
      expect(loadState.errorCode).to.equal('test_error');
    });
  });

  describe('clearProject', () => {
    it('resets to initial state', () => {
      setProjectSuccess(mockProject);
      clearProject();

      expect(projectState.get()).to.be.null;
      expect(projectLoadingState.get().status).to.equal('idle');
      expect(bmadServicesAvailable$.get()).to.be.false;
    });
  });
});
