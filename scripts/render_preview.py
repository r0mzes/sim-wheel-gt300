import numpy as np, struct, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
def load(f):
    d=open(f,'rb').read(); n=struct.unpack('<I',d[80:84])[0]
    a=np.frombuffer(d[84:84+n*50],dtype=np.dtype([('n','<3f4'),('v','<9f4'),('a','<u2')]))
    return a['v'].reshape(-1,3,3)
def draw(ax,T,color,elev,azim):
    n=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]); n/=np.linalg.norm(n,axis=1,keepdims=True)+1e-9
    L=np.array([0.3,-0.5,0.8]);L/=np.linalg.norm(L); sh=np.clip(np.abs(n@L),0.15,1)
    c=np.array(matplotlib.colors.to_rgb(color)); cols=np.clip(c*(0.35+0.75*sh[:,None]),0,1)
    ax.add_collection3d(Poly3DCollection(T,facecolors=cols,edgecolors='none'))
    mn=T.reshape(-1,3).min(0); mx=T.reshape(-1,3).max(0); c0=(mn+mx)/2; r=(mx-mn).max()/2
    ax.set_xlim(c0[0]-r,c0[0]+r); ax.set_ylim(c0[1]-r,c0[1]+r); ax.set_zlim(c0[2]-r,c0[2]+r)
    ax.view_init(elev,azim); ax.set_axis_off(); ax.set_box_aspect((1,1,1))
fig=plt.figure(figsize=(14,9))
ax=fig.add_subplot(2,3,1,projection='3d'); A=load('prev/_assembly_preview.stl')
draw(ax,A[:,:, [0,2,1]]*[1,-1,1],'#555',15,-60); ax.set_title('Сборка (вид сзади-сбоку)')
for i,(f,t,col) in enumerate([('rim_front_3h','Обод ПЕРЕД 3ч (на столе)','#333'),('rim_back_4-30','Обод ЗАД 4:30 (на столе)','#444'),('hub_PCD50.8','Ступица','#889'),('spoke_3h','Спица (на ребре)','#557'),('rim_back_1-30','Обод ЗАД 1:30','#444')]):
    ax=fig.add_subplot(2,3,i+2,projection='3d'); draw(ax,load(f'prev/{f}.stl'),col,55,-70); ax.set_title(t)
plt.tight_layout(); plt.savefig('preview.png',dpi=90)
