import { Router } from 'express';
import { classroomController } from '../controllers/classroom.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Locations
router.get('/locations', classroomController.getLocations.bind(classroomController));
router.post('/locations', classroomController.createLocation.bind(classroomController));
router.put('/locations/:id', classroomController.updateLocation.bind(classroomController));
router.delete('/locations/:id', classroomController.deleteLocation.bind(classroomController));

// Classrooms
router.get('/conflict-check', classroomController.checkConflict.bind(classroomController));
router.get('/', classroomController.getClassrooms.bind(classroomController));
router.post('/', classroomController.createClassroom.bind(classroomController));
router.get('/:id', classroomController.getClassroomById.bind(classroomController));
router.put('/:id', classroomController.updateClassroom.bind(classroomController));
router.delete('/:id', classroomController.deleteClassroom.bind(classroomController));

export default router;
